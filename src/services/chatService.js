// chatService.js
// Quản lý luồng RAG tư vấn pháp lý chính thức. Tích hợp đồng bộ cả 6 giải thuật:
// Bloom Filter (ở controller), Semantic Cache ANN, Aho-Corasick Trie, Cosine Similarity, REST Vector Search, Reranking & Merge Sort.

const { db, admin, serviceAccount } = require('../config/firebase');
const { generateEmbedding } = require('./aiService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const path = require('path');

// Import các giải thuật và cấu trúc dữ liệu mới
const { searchInCache, saveToCache } = require('./semanticCacheService');
const { extractLegalEntities } = require('../utils/dictionaryHelper');
const { sortDocumentsByRelevance } = require('../utils/mergeSort');

/**
 * REST API tìm kiếm Vector tương đồng trên Firestore (sử dụng HNSW đằng sau)
 * @param {string} userQuery Câu hỏi người dùng
 * @param {number[]} queryVector Vector embedding có sẵn của câu hỏi (768 chiều)
 * @returns {Promise<Array>} Danh sách 20 bản án thô (Cosine Similarity)
 */
const findSimilarJudgmentsREST = async (userQuery, queryVector = null) => {
    try {
        console.log("🔍 [Vector Search] Bắt đầu tìm kiếm bản án tương đồng cho:", userQuery);

        // 1. Tạo Vector nếu chưa truyền vào
        let vector = queryVector;
        if (!vector) {
            vector = await generateEmbedding(userQuery);
        }

        if (!vector) {
            console.error("❌ Không tạo được vector");
            return [];
        }

        // 2. Lấy project ID từ service account
        const projectId = serviceAccount.project_id;

        // 3. Lấy access token từ service account
        console.log("🔑 Đang xác thực với Google...");
        const auth = new GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/datastore'],
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const accessToken = tokenResponse.token;

        // 4. Gọi Firestore REST API để vector search
        console.log("📡 Đang gọi Firestore REST API (vector search HNSW)...");
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

        const requestBody = {
            structuredQuery: {
                from: [{ collectionId: "judgments" }],
                findNearest: {
                    vectorField: { fieldPath: "embedding_vector" },
                    queryVector: {
                        mapValue: {
                            fields: {
                                __type__: { stringValue: "__vector__" },
                                value: {
                                    arrayValue: {
                                        values: vector.map(v => ({ doubleValue: v }))
                                    }
                                }
                            }
                        }
                    },
                    distanceMeasure: "COSINE",
                    limit: 20 // Tăng từ 5 lên 20 để lấy tập thô lớn phục vụ bước Reranking
                },
            }
        };

        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        console.log(`📊 REST API phản hồi thành công.`);

        // 5. Parse kết quả bản án thô
        const results = [];
        if (response.data && Array.isArray(response.data)) {
            for (const item of response.data) {
                if (item.document && item.document.fields) {
                    const fields = item.document.fields;
                    results.push({
                        so_ban_an: fields.so_ban_an?.stringValue || "N/A",
                        ngay_tuyen: fields.ngay_tuyen?.stringValue || "N/A",
                        toi_danh: fields.toi_danh?.stringValue || "Không xác định",
                        hanh_vi: fields.chi_tiet_vu_an?.mapValue?.fields?.hanh_vi?.stringValue || "N/A",
                        hinh_phat: fields.phap_ly?.mapValue?.fields?.hinh_phat?.stringValue || "N/A",
                        dieu_luat: fields.phap_ly?.mapValue?.fields?.dieu_luat_day_du?.stringValue || "N/A",
                    });
                }
            }
        }

        console.log(`📊 Tìm thấy ${results.length} bản án thô.`);
        return results;
    } catch (error) {
        console.error("❌ Lỗi findSimilarJudgments (REST):");
        if (error.response) {
            console.error("  Status:", error.response.status);
            console.error("  Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("  Message:", error.message);
        }
        return [];
    }
};

/**
 * Chấm điểm độ liên quan (Relevance Score) của các bản án thô so với câu hỏi (Cross-Encoder)
 * @param {string} userQuery Câu hỏi của người dùng
 * @param {Array} judgments Danh sách bản án thô
 * @returns {Promise<Array>} Danh sách bản án đã được gán điểm relevanceScore
 */
const rerankJudgments = async (userQuery, judgments) => {
    if (!judgments || judgments.length === 0) return [];

    console.log(`🔄 [Reranker] Đang chấm điểm Relevance Score cho ${judgments.length} bản án bằng Cross-Encoder...`);

    // Tối giản cấu trúc bản án gửi lên AI để tiết kiệm tối đa token và giảm thiểu độ trễ
    const docsForAI = judgments.map((j, index) => ({
        index: index,
        toi_danh: j.toi_danh,
        hanh_vi: j.hanh_vi,
        dieu_luat: j.dieu_luat,
        hinh_phat: j.hinh_phat
    }));

    const prompt = `
Bạn là một chuyên gia pháp lý và kiểm định hồ sơ án lệ Việt Nam.
Hãy chấm điểm mức độ liên quan ngữ nghĩa chi tiết (từ 0 đến 100) của các bản án lệ đối với câu hỏi của người dùng dưới đây.

Câu hỏi của người dùng: "${userQuery}"

Danh sách bản án lệ cần chấm điểm:
${JSON.stringify(docsForAI, null, 2)}

Tiêu chí chấm điểm:
- 90-100: Bản án lệ có hành vi vi phạm, lỗi, hoặc tội danh giống hệt/rất sát với nội dung câu hỏi.
- 60-89: Bản án lệ có cùng chủ đề, cùng nhóm lỗi hoặc tội danh nhưng chi tiết hành vi có chút khác biệt.
- 30-59: Bản án lệ chỉ liên quan gián tiếp, có chung từ khóa nhưng bản chất pháp lý khác nhau.
- 0-29: Bản án lệ hoàn toàn không liên quan đến câu hỏi.

HÃY PHÂN TÍCH KỸ HÀNH VI CỦA TỪNG BẢN ÁN TRƯỚC KHI CHẤM ĐIỂM.
TRẢ VỀ KẾT QUẢ DƯỚI ĐẠNG JSON CHÍNH XÁC SAU (KHÔNG THÊM BẤT KỲ CHỮ NÀO KHÁC NGOÀI JSON):
{
  "scores": [
    { "index": 0, "score": 95 },
    { "index": 1, "score": 45 }
  ]
}
`;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Sử dụng gemini-2.5-flash để đảm bảo phản hồi siêu tốc
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.1
            }
        });

        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        if (parsed && Array.isArray(parsed.scores)) {
            for (const scoreObj of parsed.scores) {
                const idx = scoreObj.index;
                if (judgments[idx]) {
                    judgments[idx].relevanceScore = scoreObj.score;
                }
            }
        }

        // Đảm bảo tất cả các bản án đều có relevanceScore
        for (const j of judgments) {
            if (j.relevanceScore === undefined) {
                j.relevanceScore = 0;
            }
        }

        console.log(" ✅ Chấm điểm Reranker thành công!");
        return judgments;
    } catch (error) {
        console.error("❌ Lỗi khi chạy Cross-Encoder Reranking:", error.message);
        // Fallback: Gán bằng 0 nếu lỗi để giữ nguyên thứ tự thô từ vector search
        for (const j of judgments) {
            j.relevanceScore = 0;
        }
        return judgments;
    }
};

/**
 * Luồng RAG Tư vấn Pháp luật hoàn chỉnh
 * @param {string} userQuery Câu hỏi của người dùng
 * @returns {Promise<string>} Câu trả lời pháp lý tối ưu
 */
const generateLegalConsultation = async (userQuery) => {
    try {
        console.log("🔍 [RAG Flow] Bước 1: Kiểm tra ý định người dùng (Greetings)...");

        // 1. Kiểm tra nhanh các từ khóa giao tiếp cơ bản (greetings)
        const greetings = ["hi", "hello", "chào", "xin chào", "tạm biệt", "bye"];
        if (greetings.includes(userQuery.toLowerCase().trim())) {
            console.log("👋 Phát hiện lời chào, trả về lời chào mặc định.");
            return "Xin chào! Tôi là trợ lý ảo tư vấn luật giao thông. Bạn cần tôi hỗ trợ gì về các quy định pháp luật hoặc lỗi vi phạm giao thông không?";
        }

        // 2. Tạo Vector Embedding cho câu hỏi của người dùng
        console.log("📐 [RAG Flow] Bước 2: Tạo Vector Embedding cho câu hỏi...");
        const queryVector = await generateEmbedding(userQuery);

        if (!queryVector) {
            throw new Error("Không thể tạo vector cho câu hỏi đầu vào.");
        }

        // 3. Tra cứu Semantic Cache (ANN) bằng khoảng cách Cosine
        console.log("🧠 [RAG Flow] Bước 3: Tra cứu Semantic Cache (ANN)...");
        const cachedAnswer = await searchInCache(userQuery, queryVector, 0.95);
        if (cachedAnswer) {
            console.log("⚡ [RAG Flow] HIT SEMANTIC CACHE! Trả về kết quả tức thì.");
            return cachedAnswer;
        }

        // 4. Nếu Cache Miss, chạy Aho-Corasick Trie trích xuất thực thể
        console.log("🌳 [RAG Flow] Bước 4: Trích xuất thực thể bằng Cây Trie (Aho-Corasick)...");
        const entities = extractLegalEntities(userQuery);
        if (entities.length > 0) {
            console.log(` 📌 Phát hiện các thực thể pháp lý trong câu hỏi: [${entities.join(", ")}]`);
        } else {
            console.log(" 📌 Không phát hiện thực thể pháp lý cụ thể.");
        }

        // 5. Tìm kiếm Vector thô (Firestore REST HNSW API) - Lấy Top 20
        console.log("📡 [RAG Flow] Bước 5: Tìm kiếm Vector thô (Firestore HNSW REST)...");
        const similarJudgments = await findSimilarJudgmentsREST(userQuery, queryVector);
        console.log(" ✅ Tìm kiếm thô xong. Số lượng bản án lấy được:", similarJudgments.length);

        if (similarJudgments.length === 0) {
            console.log("⚠️ Không tìm thấy tiền lệ tương đồng nào trong DB.");
            return "Xin lỗi, hiện tôi không tìm thấy bản án tiền lệ nào tương đồng trong cơ sở dữ liệu để tư vấn chính xác cho bạn.";
        }

        // 6. Reranking (Cross-Encoder) chấm điểm Relevance Score cho 20 bản án thô
        console.log("🔄 [RAG Flow] Bước 6: Chấm điểm Reranking các bản án...");
        const scoredJudgments = await rerankJudgments(userQuery, similarJudgments);

        // 7. Sử dụng thuật toán Merge Sort ổn định sắp xếp lại theo Relevance Score giảm dần
        console.log("🥞 [RAG Flow] Bước 7: Sắp xếp bằng Merge Sort ổn định...");
        const sortedJudgments = sortDocumentsByRelevance(scoredJudgments);

        // Lấy Top 5 kết quả tốt nhất và LỌC bỏ các bản án không liên quan (điểm < 40)
        const topJudgments = sortedJudgments.slice(0, 5).filter(j => j.relevanceScore >= 40);
        
        if (topJudgments.length === 0) {
            console.log("⚠️ Tất cả bản án đều có độ tương đồng thấp (dưới ngưỡng 40). Chặn sinh câu trả lời rác.");
            return "Dạ hiện tại trong hệ thống chưa lưu trữ bản án lệ nào sát với tình huống vi phạm này nên em chưa thể đưa ra tư vấn chính xác nhất ạ. Anh/chị thử hỏi về các lỗi khác xem sao nhé!";
        }

        console.log(` ✅ Lọc thành công ${topJudgments.length} bản án liên quan. Bản án tốt nhất có điểm: ${topJudgments[0].relevanceScore}`);

        // 8. Đóng gói Context từ các bản án chất lượng
        console.log("📝 [RAG Flow] Bước 8: Đóng gói Context...");
        let context = topJudgments.map((j, index) => {
            return `Tiền lệ ${index + 1} (Điểm phù hợp: ${j.relevanceScore}/100):
            - Số hiệu: ${j.so_ban_an} ngày ${j.ngay_tuyen}
            - Tội danh: ${j.toi_danh}
            - Hành vi: ${j.hanh_vi}
            - Điều luật áp dụng: ${j.dieu_luat}
            - Hình phạt đã tuyên: ${j.hinh_phat}`;
        }).join("\n\n");

        // 9. Sinh câu trả lời cuối cùng với Gemini LLM (sử dụng danh sách model dự phòng)
        console.log("🤖 [RAG Flow] Bước 9: Gọi Gemini LLM để sinh câu trả lời...");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const prompt = `
            Đóng vai là nhân viên tư vấn luật giao thông đang chat trực tiếp với khách hàng.
            Câu hỏi: "${userQuery}"
            Tiền lệ: ${context}
            
            QUY TẮC BẮT BUỘC (VI PHẠM SẼ BỊ PHẠT NGHIÊM TRỌNG):
            1. ĐỘ DÀI: CỰC KỲ NGẮN GỌN! Trả lời tối đa 3-4 câu (dưới 100 chữ). KHÔNG liệt kê các trường hợp "Nếu thế này... Nếu thế kia...". Chỉ trả lời thẳng vào tình huống khách hỏi.
            2. NỘI DUNG: Đi thẳng vào trọng tâm: Lỗi gì? Phạt bao nhiêu? Có giam bằng/giữ xe không? KHÔNG trích dẫn luật dài dòng.
            3. XƯNG HÔ VÀ VĂN PHONG: Bắt buộc xưng "em" và gọi "anh/chị" tự nhiên như tin nhắn messenger. Tuyệt đối KHÔNG gạch đầu dòng chi chít hay bôi đậm tiêu đề.
            4. TIỀN LỆ: Chỉ lồng ghép nhẹ 1 câu duy nhất. Ví dụ: "Thực tế có vụ án số... cũng lỗi này bị xử phạt rất nặng đó ạ." (Nếu tiền lệ không khớp thì bỏ qua luôn).
            5. TỪ CHỐI KHÉO: Nếu hỏi ngoài lề giao thông: "Dạ xin lỗi anh/chị, em chỉ hỗ trợ về giao thông thôi ạ."
        `;


        const fallbackModels = ["gemini-2.5-flash", "gemini-flash-latest"];
        let answerText = "";

        for (let i = 0; i < fallbackModels.length; i++) {
            const currentModelName = fallbackModels[i];
            const model = genAI.getGenerativeModel({ model: currentModelName });

            try {
                console.log(`Đang thử model: ${currentModelName}...`);
                const result = await model.generateContent(prompt);
                answerText = result.response.text();
                console.log(` ✅ Model ${currentModelName} phản hồi thành công.`);
                break; // Thoát vòng lặp khi sinh thành công
            } catch (geminiError) {
                if (geminiError.message && geminiError.message.includes('503 Service Unavailable')) {
                    console.log(`⚠️ Model ${currentModelName} bị 503 (Quá tải).`);
                    if (i < fallbackModels.length - 1) {
                        console.log("🔄 Chuyển sang model dự phòng kế tiếp...");
                        continue;
                    }
                }
                console.error(`❌ Lỗi tại ${currentModelName}:`, geminiError.message);
                if (i === fallbackModels.length - 1) {
                    throw new Error(`AI Error: ${geminiError.message}`);
                }
            }
        }

        if (!answerText) {
            throw new Error("Không thể sinh câu trả lời từ AI.");
        }

        // 10. Ghi nhận kết quả mới vào Semantic Cache (RAM + Firestore)
        console.log("💾 [RAG Flow] Bước 10: Lưu trữ câu trả lời mới vào Semantic Cache...");
        await saveToCache(userQuery, queryVector, answerText);

        return answerText;
    } catch (error) {
        const msg = error.message || "Lỗi không xác định trong quá trình sinh phản hồi.";
        console.error("❌ Lỗi generateLegalConsultation:", msg);
        throw new Error(msg);
    }
};

module.exports = {
    findSimilarJudgmentsREST,
    rerankJudgments,
    generateLegalConsultation
};
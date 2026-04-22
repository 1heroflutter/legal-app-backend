const { db, admin } = require('../config/firebase');
const { generateEmbedding } = require('./aiService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const path = require('path');

// --- Vector Search via REST API (bypass gRPC native crash) ---
const findSimilarJudgmentsREST = async (userQuery) => {
    try {
        console.log("🔍 Đang tìm kiếm bản án tương đồng cho:", userQuery);

        // 1. Tạo Vector
        const queryVector = await generateEmbedding(userQuery);
        if (!queryVector) {
            console.error("❌ Không tạo được vector");
            return [];
        }

        // 2. Lấy project ID từ service account
        const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));
        const projectId = serviceAccount.project_id;

        // 3. Lấy access token từ service account
        console.log("🔑 Đang xác thực với Google...");
        const auth = new GoogleAuth({
            keyFile: path.join(__dirname, '../../serviceAccountKey.json'),
            scopes: ['https://www.googleapis.com/auth/datastore'],
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const accessToken = tokenResponse.token;

        // 4. Gọi Firestore REST API để vector search
        console.log("📡 Đang gọi Firestore REST API (vector search)...");
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
                                        values: queryVector.map(v => ({ doubleValue: v }))
                                    }
                                }
                            }
                        }
                    },
                    distanceMeasure: "COSINE",
                    limit: 5
                },
            }
        };

        console.log("📡 Đang gửi request tới Firestore REST API...");
        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        console.log(`📊 REST API phản hồi thành công.`);

        // 5. Parse kết quả
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

        console.log(`📊 Tìm thấy ${results.length} bản án.`);
        return results;
    } catch (error) {
        console.error("❌ Lỗi findSimilarJudgments (REST):");
        if (error.response) {
            console.error("  Status:", error.response.status);
            console.error("  Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("  Message:", error.message);
        }
        return []; // Return empty instead of crashing
    }
};

const generateLegalConsultation = async (userQuery) => {
    try {
        console.log("🔍 [Step 1] Kiểm tra ý định người dùng...");

        // 1. Kiểm tra nhanh các từ khóa giao tiếp cơ bản
        const greetings = ["hi", "hello", "chào", "xin chào", "tạm biệt", "bye"];
        if (greetings.includes(userQuery.toLowerCase().trim())) {
            console.log("👋 [Step 1.1] Phát hiện lời chào, bỏ qua tìm kiếm tiền lệ.");
            return "Xin chào! Tôi là trợ lý ảo tư vấn luật giao thông. Bạn cần tôi hỗ trợ gì về các quy định pháp luật or lỗi vi phạm giao thông không?";
        }

        console.log("🔍 [Step 2] Khởi chạy findSimilarJudgments (REST)...");
        const similarJudgments = await findSimilarJudgmentsREST(userQuery);
        console.log("✅ [Step 3] Tìm kiếm tiền lệ xong. Số lượng:", similarJudgments.length);

        if (similarJudgments.length === 0) {
            console.log("⚠️ [Step 4] Không thấy tiền lệ, trả về thông báo mặc định.");
            return "Xin lỗi, hiện tôi không tìm thấy bản án tiền lệ nào tương đồng để tư vấn chính xác cho bạn.";
        }

        console.log("📝 [Step 5] Đang đóng gói context...");

        let context = similarJudgments.map((j, index) => {
            return `Tiền lệ ${index + 1}:
            - Số hiệu: ${j.so_ban_an} ngày ${j.ngay_tuyen}
            - Tội danh: ${j.toi_danh}
            - Hành vi: ${j.hanh_vi}
            - Điều luật: ${j.dieu_luat}
            - Hình phạt đã tuyên: ${j.hinh_phat}`;
        }).join("\n\n");

        console.log("🤖 [Step 6] Khởi tạo Gemini...");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const prompt = `
            Bạn là chuyên gia tư vấn luật giao thông Việt Nam.
            Câu hỏi: "${userQuery}"

            Các tiền lệ tham khảo từ Cơ sở dữ liệu:
            ${context}
            
            YÊU CẦU BẮT BUỘC TỐI THƯỢNG:
            1. GIỚI HẠN LĨNH VỰC: Bạn CHỈ ĐƯỢC PHÉP trả lời các câu hỏi liên quan đến Luật Giao thông. Bất kỳ câu hỏi nào về ma túy, hình sự chung, ly hôn, lừa đảo... đều PHẢI BỊ TỪ CHỐI TRẢ LỜI bằng câu: "Xin lỗi, tôi chỉ là trợ lý hỗ trợ chuyên biệt về lĩnh vực Luật Giao thông đường bộ. Tôi không thể tư vấn các vấn đề pháp lý khác." Tuyệt đối không dùng dữ liệu trên mạng để trả lời lấn sân cũng như không bịa ra thông tin mà phải 100% dựa vào các bản án lệ trong database. 
            2. TRẢ LỜI TRỰC DIỆN NGAY LẬP TỨC: Không dài dòng chào hỏi. Đưa ra luôn mức phạt hoặc giải thích.
            3. XỬ LÝ TIỀN LỆ: Tuyệt đối KHÔNG liệt kê, tóm tắt lại "Tiền lệ 1, Tiền lệ 2..." nếu chúng không thực sự khớp với tình huống. Nếu câu hỏi về giao thông mà tiền lệ truy xuất hoàn toàn sai lệch, hãy bỏ qua tiền lệ và tự trả lời bằng kiến thức luật giao thông của bạn một cách ngắn gọn.
            4. Trình bày thật súc tích, dễ hiểu.
        `;

        console.log("🤖 [Step 7] Đang gọi Gemini...");

        // Cấu hình danh sách các model dự phòng để auto-fallback
        const fallbackModels = ["gemini-2.5-flash", "gemini-flash-latest"];

        for (let i = 0; i < fallbackModels.length; i++) {
            const currentModelName = fallbackModels[i];
            const model = genAI.getGenerativeModel({ model: currentModelName });

            try {
                console.log(`Đang thử model: ${currentModelName}...`);
                const result = await model.generateContent(prompt);
                const textResponse = result.response.text();
                console.log(`✅ [Step 8] Model ${currentModelName} phản hồi thành công.`);
                return textResponse;
            } catch (geminiError) {
                if (geminiError.message && geminiError.message.includes('503 Service Unavailable')) {
                    console.log(`⚠️ Model ${currentModelName} bị 503 (Quá tải).`);
                    if (i < fallbackModels.length - 1) {
                        console.log("🔄 Đang chuyển sang model dự phòng kế tiếp...");
                        continue; // Chuyển sang model tiếp theo ngay lập tức
                    } else {
                        // Hết model dự phòng rùi
                        throw new Error(`Tất cả các AI models đều đang quá tải. Vui lòng thử lại sau ít phút.`);
                    }
                }

                // Nếu lỗi khác 503 (chẳng hạn 429 Quota exhausted), thì tung lỗi luôn
                console.error(`❌ Lỗi tại ${currentModelName}:`, geminiError);
                throw new Error(`AI Error: ${geminiError.message}`);
            }
        }

    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        console.error("❌ Lỗi generateLegalConsultation:", msg);
        throw new Error(msg);
    }
};

module.exports = { generateLegalConsultation };
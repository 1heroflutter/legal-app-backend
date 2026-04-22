//aiService.js

const axios = require("axios");
const { extractSections } = require("../utils/extractSections");
const { GoogleGenerativeAI } = require('@google/generative-ai');

const parseJudgmentToJSON = async (rawText) => {
    if (!rawText || rawText.length < 50) return null;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const sections = extractSections(rawText);

    // Log để debug
    console.log("📊 SECTION LENGTHS:", {
        quyet_dinh: sections.quyet_dinh.length,
        nhan_dinh: sections.nhan_dinh.length,
        thong_tin: sections.thong_tin.length
    });

    let textToProcess = "";

    // Ưu tiên phần QUYẾT ĐỊNH
    if (sections.quyet_dinh && sections.quyet_dinh.length > 100) {
        textToProcess = `
=== PHẦN QUYẾT ĐỊNH (PHẦN QUAN TRỌNG NHẤT - NGUỒN DUY NHẤT CHO HÌNH PHẠT, TỘI DANH) ===
${sections.quyet_dinh}

=== PHẦN NHẬN ĐỊNH ===
${sections.nhan_dinh.substring(0, 10000)}

=== THÔNG TIN CHUNG ===
${sections.thong_tin}
`;
    } else {
        // Fallback: lấy phần cuối của bản án
        const lastPart = sections.full.substring(Math.max(0, sections.full.length - 8000));
        textToProcess = `
=== PHẦN CUỐI BẢN ÁN (CÓ THỂ CHỨA QUYẾT ĐỊNH) ===
${lastPart}

=== THÔNG TIN CHUNG ===
${sections.thong_tin}
`;
    }

    const prompt = `
Bạn là chuyên gia pháp lý Việt Nam. Phân tích bản án và trả về JSON.

⚠️ QUY TẮC QUAN TRỌNG NHẤT:

1. PHẦN "QUYẾT ĐỊNH" là nguồn DUY NHẤT để xác định:
   - Tội danh (thường xuất hiện sau "tuyên bố" hoặc "xử phạt")
   - Điều luật (thường có dạng "Điều ...", "khoản ...", "điểm ...")
   - Hình phạt (tù, án treo, cải tạo, phạt tiền...)
   - Thời hạn tù (nếu có)

2. CÁCH XÁC ĐỊNH:
   - Tìm cụm "TUYÊN BỐ:" hoặc "XỬ PHẠT:" để biết tội danh
   - Tìm "áp dụng" hoặc "căn cứ vào" để biết điều luật
   - Nếu có "cho hưởng án treo" thì an_treo = true

3. ĐỊNH DẠNG JSON CHÍNH XÁC:
{
  "so_ban_an": "",           // Số bản án
  "ngay_tuyen": "",           // Ngày tuyên án
  "toi_danh": "",            // Tội danh chính xác từ quyết định
  
  "bi_cao": [                // Thông tin bị cáo
    {
      "ten": "",
      "nam_sinh": 0,
      "nghe_nghiep": ""
    }
  ],
  
  "chi_tiet_vu_an": {        // Chi tiết vụ án
    "hanh_vi": "",
    "hau_qua": "",
    "nong_do_con": ""
  },
  
  "phap_ly": {
    "dieu_luat_day_du": "",  // Điều luật đầy đủ (ví dụ: "Điều 260 BLHS")
    "khoan_dieu": [],        // Khoản (ví dụ: [1, 2, 3])
    "diem": [],              // Điểm (ví dụ: ["a", "b", "c"])
    "bo_luat": "BLHS 2015",  // Bộ luật áp dụng
    
    "tinh_tiet_giam_nhe": [], // Tình tiết giảm nhẹ
    "tinh_tiet_tang_nang": [], // Tình tiết tăng nặng
    
    "hinh_phat": "",          // Hình phạt cụ thể
    "loai_hinh_phat": "",     // Loại: "tù", "cải tạo", "phạt tiền", "tử hình"...
    "thoi_han": "",          // Thời hạn (nếu có)
    "an_treo": false          // Có được hưởng án treo không?
  }
}

--- VĂN BẢN CẦN PHÂN TÍCH ---
${textToProcess}

--- HÃY TRẢ VỀ JSON CHÍNH XÁC ---
`;

    try {
        const promptData = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.1
            }
        };

        const response = await axios.post(url, promptData, { timeout: 30000 });
        const text = response.data.candidates[0].content.parts[0].text;

        // Parse và validate kết quả
        const result = JSON.parse(text);

        // Log kết quả để debug
        console.log("📝 KẾT QUẢ AI:", {
            toi_danh: result.toi_danh,
            dieu_luat: result.phap_ly?.dieu_luat_day_du,
            hinh_phat: result.phap_ly?.hinh_phat,
            an_treo: result.phap_ly?.an_treo
        });

        return result;

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error("[AI ERROR]:", errorMsg);

        // Thử lại với text ngắn hơn nếu lỗi 400
        if (error.response?.status === 400 && rawText.length > 5000) {
            console.log("🔄 Thử lại với text ngắn hơn...");
            return parseJudgmentToJSON(rawText.substring(0, 4000));
        }

        throw new Error(`AI Analysis Error: ${errorMsg}`);
    }
};

const generateEmbedding = async (text) => {
    if (!text) return null;
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

    try {
        const cleanText = text.replace(/\n/g, " ").substring(0, 8000);
        const response = await axios.post(url, {
            model: "models/gemini-embedding-001",
            content: {
                parts: [{ text: cleanText }]
            },
            outputDimensionality: 768
        }, { timeout: 60000 }); // Increase timeout for slower networks

        if (response.data && response.data.embedding) {
            console.log("📏 Vector mới tạo: ", response.data.embedding.values.length);
            return response.data.embedding.values;
        }
        return null;
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error("❌ [EMBEDDING ERROR]:", errorMsg);
        throw new Error(`Embedding Error: ${errorMsg}`);
    }
};

module.exports = { parseJudgmentToJSON, generateEmbedding };
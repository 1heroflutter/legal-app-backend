const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const admin = require('firebase-admin');
const { db } = require('../src/config/firebase');
const { generateEmbedding } = require('../src/services/aiService');

async function vectorizeDB() {
    // Thêm dòng này để kiểm tra ngay lập tức
    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ LỖI: Không tìm thấy GEMINI_API_KEY trong .env");
        process.exit(1);
    }

    const snapshot = await db.collection("judgments").get();
    console.log(`Đang xử lý ${snapshot.size} bản án...`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.embedding_vector) continue;

        console.log(`Đang tạo Vector cho: ${data.so_ban_an}`);
        const textForEmbedding = `Tội danh: ${data.toi_danh}. Hành vi: ${data.chi_tiet_vu_an.hanh_vi}. Pháp lý: ${data.phap_ly.dieu_luat_day_du}`;
        
        const vector = await generateEmbedding(textForEmbedding);
        
        if (vector) {
            await doc.ref.update({ embedding_vector: admin.firestore.FieldValue.vector(vector) });
            console.log(" ✅ Thành công");
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.error(" ❌ Thất bại - Dừng script để kiểm tra key.");
            process.exit(1);
        }
    }
    console.log("🎉 Hoàn tất Vector hóa dữ liệu!");
}

vectorizeDB();
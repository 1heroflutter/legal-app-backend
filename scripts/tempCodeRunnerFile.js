require('dotenv').config();
const { db } = require('../src/config/firebase');
const { generateEmbedding } = require('../src/services/aiService');

async function vectorizeDB() {
    const snapshot = await db.collection("judgments").get();
    console.log(`Đang xử lý ${snapshot.size} bản án...`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Nếu đã có vector rồi thì bỏ qua
        if (data.embedding_vector) continue;

        console.log(`Đang tạo Vector cho: ${data.so_ban_an}`);
        
        // Kết hợp thông tin quan trọng để tạo Vector
        const textForEmbedding = `Tội danh: ${data.toi_danh}. Hành vi: ${data.chi_tiet_vu_an.hanh_vi}. Pháp lý: ${data.phap_ly.dieu_luat_day_du}`;
        
        const vector = await generateEmbedding(textForEmbedding);
        
        if (vector) {
            await doc.ref.update({ embedding_vector: vector });
            // Đợi một chút tránh rate limit của API Free
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    console.log("Hoàn tất Vector hóa dữ liệu!");
}

vectorizeDB();
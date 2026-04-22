const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const admin = require('firebase-admin');
const { db } = require('../src/config/firebase');

async function migrateVectors() {
    console.log("🚀 Bắt đầu chuyển đổi dữ liệu Vector (Array -> VectorValue)...");
    
    try {
        const snapshot = await db.collection("judgments").get();
        console.log(`Tìm thấy ${snapshot.size} bản án.`);

        let count = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Kiểm tra nếu embedding_vector đang là Mảng thông thường
            if (data.embedding_vector && Array.isArray(data.embedding_vector)) {
                console.log(`- Đang xử lý: ${data.so_ban_an || doc.id}`);
                
                await doc.ref.update({
                    embedding_vector: admin.firestore.FieldValue.vector(data.embedding_vector)
                });
                count++;
            }
        }

        console.log(`\n✅ HOÀN TẤT! Đã chuyển đổi ${count}/${snapshot.size} bản án.`);
        console.log("⚠️ LƯU Ý: Đừng quên tạo Vector Index trên Firebase Console nếu chưa làm!");
        process.exit(0);
    } catch (err) {
        console.error("❌ LỖI DI CƯ DỮ LIỆU:", err.message);
        process.exit(1);
    }
}

migrateVectors();

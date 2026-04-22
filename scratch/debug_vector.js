const { db, admin } = require('../src/config/firebase');

async function debugVector() {
    console.log("🚀 Bắt đầu test Vector Search...");
    
    try {
        // 1. Tạo vector giả (768 chiều)
        const dummyVector = Array(768).fill(0.1);
        console.log("✅ Đã tạo vector giả.");

        // 2. Chuẩn bị VectorValue
        console.log("📡 Đang chuẩn bị VectorValue...");
        const vectorValue = admin.firestore.FieldValue.vector(dummyVector);
        
        // 3. Truy vấn thử
        console.log("🔍 Đang gọi findNearest...");
        const judgmentsRef = db.collection("judgments");
        const snapshot = await judgmentsRef.findNearest("embedding_vector", vectorValue, {
            distanceMeasure: "COSINE",
            limit: 1
        }).get();

        console.log("📊 Kết quả thành công! Tìm thấy:", snapshot.size, "bản án.");
        
    } catch (error) {
        console.error("❌ LỖI TRONG KHI TEST:");
        console.error(error.stack || error);
    } finally {
        console.log("🏁 Kết thúc test.");
        process.exit(0);
    }
}

debugVector();

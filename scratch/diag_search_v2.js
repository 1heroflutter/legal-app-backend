const path = require('path');
const admin = require('firebase-admin');
const { db } = require(path.resolve(__dirname, '../src/config/firebase'));

async function testSearch() {
    try {
        const dummyVector = new Array(768).fill(0.1);
        const judgmentsRef = db.collection("judgments");
        
        // Cố gắng dùng VectorValue (nếu SDK hỗ trợ)
        // Nếu dùng firebase-admin 13+, dùng admin.firestore.FieldValue.vector
        const vectorValue = admin.firestore.FieldValue.vector(dummyVector);

        console.log("🔍 Đang thử tìm kiếm với VectorValue...");
        const snapshot = await judgmentsRef.findNearest({
            vectorField: "embedding_vector",
            queryVector: vectorValue,
            distanceMeasure: "COSINE", 
            limit: 1
        }).get();
        
        console.log("✅ Kết quả:", snapshot.size);
    } catch (error) {
        console.error("❌ LỖI:");
        console.error(error.message);
    }
}

testSearch();

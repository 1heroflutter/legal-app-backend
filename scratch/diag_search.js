const path = require('path');
const { db } = require(path.resolve(__dirname, '../src/config/firebase'));

async function testSearch() {
    try {
        const dummyVector = new Array(768).fill(0.1);
        const judgmentsRef = db.collection("judgments");
        
        console.log("🔍 Đang thử tìm kiếm Vector (dimension 768)...");
        const snapshot = await judgmentsRef.findNearest({
            vectorField: "embedding_vector",
            queryVector: dummyVector,
            distanceMeasure: "COSINE", 
            limit: 1
        }).get();
        
        console.log("✅ Tìm thấy:", snapshot.size, "bản án");
    } catch (error) {
        console.error("❌ LỖI TÌM KIẾM CHI TIẾT:");
        console.error(error.message);
        if (error.stack) console.error(error.stack);
    }
}

testSearch();

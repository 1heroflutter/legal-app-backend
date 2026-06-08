const { db } = require('../src/config/firebase');

async function clearSemanticCache() {
  console.log("🧹 Đang bắt đầu xóa toàn bộ Semantic Cache...");
  
  try {
    const snapshot = await db.collection("semantic_cache").get();
    
    if (snapshot.empty) {
      console.log("✅ Semantic Cache hiện đang trống, không có gì để xóa.");
      return;
    }
    
    console.log(`⚠️ Tìm thấy ${snapshot.size} bản ghi. Đang tiến hành xóa...`);
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log("✅ Xóa Semantic Cache thành công!");
    
  } catch (error) {
    console.error("❌ Lỗi khi xóa Semantic Cache:", error);
  }
}

clearSemanticCache();

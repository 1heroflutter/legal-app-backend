// semanticCacheService.js
// Triển khai cơ chế bộ nhớ đệm ngữ nghĩa hai lớp (RAM và Firestore) dựa trên khoảng cách Cosine
// sử dụng thuật toán Tìm kiếm lân cận gần nhất (ANN) để tái sử dụng câu trả lời cũ siêu tốc (<200ms).

const { db } = require('../config/firebase');
const { cosineSimilarity } = require('../utils/cosineSimilarity');

// Mảng lưu trữ Cache trong RAM
let ramCache = [];

/**
 * Tải toàn bộ dữ liệu cache từ Firestore collection "semantic_cache" lên RAM
 */
async function initCache() {
    try {
        console.log("💾 Đang đồng bộ Semantic Cache từ Firestore lên RAM...");
        const snapshot = await db.collection("semantic_cache").get();
        ramCache = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.query && data.vector && data.response) {
                ramCache.push({
                    query: data.query,
                    vector: data.vector,
                    response: data.response
                });
            }
        });
        
        console.log(` ✅ Tải Semantic Cache thành công! Số lượng bản ghi: ${ramCache.length}`);
    } catch (error) {
        console.error("❌ Lỗi tải Semantic Cache:", error.message);
        // Không làm sập ứng dụng nếu Firestore lỗi, vẫn cho phép chạy RAM cache trống
        ramCache = [];
    }
}

/**
 * Tìm kiếm câu trả lời tương đồng nhất trong Cache bằng thuật toán ANN
 * @param {string} userQuery Câu hỏi mới của người dùng
 * @param {number[]} queryVector Vector embedding của câu hỏi mới
 * @param {number} threshold Ngưỡng tương đồng tối thiểu (mặc định 0.95)
 * @returns {string|null} Trả về câu trả lời nếu Hit Cache, ngược lại trả về null
 */
async function searchInCache(userQuery, queryVector, threshold = 0.95) {
    if (!queryVector || ramCache.length === 0) return null;

    let nearestItem = null;
    let maxSimilarity = -1;

    console.log(`🧠 [Semantic Cache] Đang duyệt ${ramCache.length} bản ghi trong bộ nhớ...`);

    // Thuật toán Tìm kiếm lân cận gần nhất (ANN) tuyến tính được tối ưu hóa
    // Quét qua toàn bộ vector trong cache memory và tính Cosine Similarity
    for (const item of ramCache) {
        try {
            const similarity = cosineSimilarity(queryVector, item.vector);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                nearestItem = item;
            }
        } catch (err) {
            console.error("❌ Lỗi tính toán Cosine Similarity trong Cache:", err.message);
        }
    }

    if (nearestItem && maxSimilarity >= threshold) {
        console.log(`🔥 [SEMANTIC CACHE HIT] Trùng khớp ngữ nghĩa!`);
        console.log(`   - Câu hỏi mới: "${userQuery}"`);
        console.log(`   - Khớp với:   "${nearestItem.query}"`);
        console.log(`   - Độ tương đồng Cosine: ${(maxSimilarity * 100).toFixed(2)}% (>= ${threshold * 100}%)`);
        return nearestItem.response;
    }

    console.log(`❄️ [SEMANTIC CACHE MISS] Độ tương đồng cao nhất chỉ đạt: ${(maxSimilarity * 100).toFixed(2)}% (< ${threshold * 100}%)`);
    return null;
}

/**
 * Lưu một cặp Câu hỏi - Vector - Câu trả lời mới vào cả RAM và Firestore
 * @param {string} query Câu hỏi
 * @param {number[]} vector Vector embedding 768 chiều
 * @param {string} response Câu trả lời từ AI
 */
async function saveToCache(query, vector, response) {
    if (!query || !vector || !response) return;

    try {
        const cleanQuery = query.trim();
        const cleanResponse = response.trim();

        // 1. Lưu vào RAM để phục vụ tức thì cho các truy vấn sau
        ramCache.push({
            query: cleanQuery,
            vector: vector,
            response: cleanResponse
        });

        // 2. Ghi song song xuống Firestore để lưu trữ bền vững
        const docId = Buffer.from(cleanQuery.substring(0, 100)).toString('base64').replace(/[\/\+=]/g, "_");
        await db.collection("semantic_cache").doc(docId).set({
            query: cleanQuery,
            vector: vector,
            response: cleanResponse,
            created_at: new Date().toISOString()
        });

        console.log(`📝 [Semantic Cache] Đã lưu thành công bản ghi cache mới cho: "${cleanQuery.substring(0, 40)}..."`);
    } catch (error) {
        console.error("❌ Lỗi ghi Semantic Cache xuống Firestore:", error.message);
    }
}

// Tự động kích hoạt tải cache khi load module
initCache();

module.exports = {
    initCache,
    searchInCache,
    saveToCache,
    getRamCacheSize: () => ramCache.length
};

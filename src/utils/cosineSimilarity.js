// cosineSimilarity.js
// Hàm toán học thuần túy tính toán độ tương đồng Cosine giữa hai vector đa chiều.

/**
 * Tính toán độ tương đồng Cosine giữa hai vector số thực đa chiều
 * @param {number[]} vecA Vector A
 * @param {number[]} vecB Vector B
 * @returns {number} Điểm tương đồng Cosine trong khoảng [-1, 1]
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    if (vecA.length !== vecB.length) {
        throw new Error(`Kích thước hai vector không đồng nhất: ${vecA.length} vs ${vecB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0; // Tránh chia cho 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { cosineSimilarity };

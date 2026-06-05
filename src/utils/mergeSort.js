// mergeSort.js
// Triển khai thuật toán sắp xếp ổn định Merge Sort (Stable Sort) 
// nhằm bảo đảm tính thứ tự ban đầu từ Vector Search đối với các văn bản có cùng điểm Rerank.

/**
 * Thuật toán Merge Sort ổn định
 * @param {Array} array Mảng các đối tượng cần sắp xếp
 * @param {Function} compareFn Hàm so sánh so sánh hai phần tử a và b. Trả về âm nếu a đứng trước, dương nếu b đứng trước, 0 nếu bằng nhau.
 * @returns {Array} Mảng mới đã được sắp xếp
 */
function mergeSort(array, compareFn) {
    if (!Array.isArray(array)) return [];
    if (array.length <= 1) {
        return [...array];
    }

    const middle = Math.floor(array.length / 2);
    const left = array.slice(0, middle);
    const right = array.slice(middle);

    return merge(
        mergeSort(left, compareFn),
        mergeSort(right, compareFn),
        compareFn
    );
}

function merge(left, right, compareFn) {
    const result = [];
    let leftIndex = 0;
    let rightIndex = 0;

    // Duyệt và trộn hai mảng đã sắp xếp
    while (leftIndex < left.length && rightIndex < right.length) {
        // So sánh left và right. Sử dụng <= 0 để giữ tính ổn định (Stable)
        // Khi hai phần tử có điểm bằng nhau, phần tử thuộc mảng bên trái (đứng trước trong mảng gốc) sẽ được đưa vào trước.
        if (compareFn(left[leftIndex], right[rightIndex]) <= 0) {
            result.push(left[leftIndex]);
            leftIndex++;
        } else {
            result.push(right[rightIndex]);
            rightIndex++;
        }
    }

    // Gộp tất cả phần tử còn lại
    return result
        .concat(left.slice(leftIndex))
        .concat(right.slice(rightIndex));
}

/**
 * Sắp xếp danh sách tài liệu theo Relevance Score giảm dần
 * Nếu hai tài liệu bằng điểm, giữ nguyên thứ tự ban đầu (Stable Sort)
 * @param {Array} documents Danh sách tài liệu (chứa trường relevanceScore)
 * @returns {Array} Danh sách tài liệu đã được sắp xếp
 */
function sortDocumentsByRelevance(documents) {
    return mergeSort(documents, (a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;

        if (scoreA > scoreB) return -1; // a đứng trước
        if (scoreA < scoreB) return 1;  // b đứng trước
        return 0;                       // Bằng nhau, giữ thứ tự
    });
}

module.exports = { mergeSort, sortDocumentsByRelevance };

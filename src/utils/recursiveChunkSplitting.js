// recursiveChunkSplitting.js
// Triển khai thuật toán Recursive Character Splitting đệ quy chia nhỏ văn bản mà không làm đứt gãy câu chữ.

const defaultSeparators = ["\n\n", "\n", ". ", "; ", ", ", " ", ""];

/**
 * Cắt văn bản theo cơ chế đệ quy tìm điểm cắt an toàn
 * @param {string} text Văn bản đầu vào cần cắt
 * @param {number} chunkSize Kích thước tối đa của mỗi chunk (ký tự)
 * @param {number} chunkOverlap Độ dài chồng lấp giữa các chunk kế tiếp (ký tự)
 * @param {string[]} separators Mảng các ký tự phân tách theo thứ tự ưu tiên
 * @returns {string[]} Danh sách các chunks kết quả
 */
function recursiveSplit(text, chunkSize = 1000, chunkOverlap = 200, separators = defaultSeparators) {
    if (!text) return [];
    
    function splitText(txt, currentSeparators) {
        if (txt.length <= chunkSize) {
            return [txt];
        }
        
        // Nếu đã thử tất cả các separators mà vẫn vượt quá chunkSize, bắt buộc cắt cứng
        if (currentSeparators.length === 0) {
            const hardChunks = [];
            let i = 0;
            while (i < txt.length) {
                hardChunks.push(txt.substring(i, Math.min(i + chunkSize, txt.length)));
                i += chunkSize - chunkOverlap;
                if (i >= txt.length || chunkSize <= chunkOverlap) break; // Tránh lặp vô hạn
            }
            return hardChunks;
        }
        
        const separator = currentSeparators[0];
        const nextSeparators = currentSeparators.slice(1);
        
        // Chia tách bằng separator hiện tại
        const parts = txt.split(separator);
        const finalParts = [];
        let currentChunk = "";
        
        for (const part of parts) {
            if (part.length > chunkSize) {
                // Nếu phần nhỏ vẫn lớn hơn chunkSize, đệ quy cắt tiếp bằng các separator tiếp theo
                if (currentChunk) {
                    finalParts.push(currentChunk);
                    currentChunk = "";
                }
                const subChunks = splitText(part, nextSeparators);
                finalParts.push(...subChunks);
            } else {
                // Thử gộp vào chunk hiện tại
                const potentialChunk = currentChunk 
                    ? currentChunk + separator + part 
                    : part;
                    
                if (potentialChunk.length <= chunkSize) {
                    currentChunk = potentialChunk;
                } else {
                    if (currentChunk) {
                        finalParts.push(currentChunk);
                    }
                    currentChunk = part;
                }
            }
        }
        
        if (currentChunk) {
            finalParts.push(currentChunk);
        }
        
        return finalParts;
    }
    
    const initialChunks = splitText(text, separators);
    
    // Gộp các chunk nhỏ lại để tối ưu hóa kích thước chunk và áp dụng sliding window overlap
    const mergedChunks = [];
    let currentBlock = "";
    
    for (const chunk of initialChunks) {
        const cleanedChunk = chunk.trim();
        if (!cleanedChunk) continue;
        
        if (!currentBlock) {
            currentBlock = cleanedChunk;
        } else {
            const combined = currentBlock + " " + cleanedChunk;
            if (combined.length <= chunkSize) {
                currentBlock = combined;
            } else {
                mergedChunks.push(currentBlock);
                // Giữ ngữ cảnh bằng cách lấy phần cuối của block hiện tại làm overlap
                // Điều chỉnh độ dài overlap tối đa có thể để block mới không bao giờ vượt quá chunkSize
                const maxOverlap = Math.min(chunkOverlap, Math.max(0, chunkSize - cleanedChunk.length - 1));
                const overlapStart = Math.max(0, currentBlock.length - maxOverlap);
                const overlapText = currentBlock.substring(overlapStart).trim();
                currentBlock = overlapText ? overlapText + " " + cleanedChunk : cleanedChunk;
            }
        }
    }
    
    if (currentBlock) {
        mergedChunks.push(currentBlock);
    }
    
    return mergedChunks;
}

module.exports = { recursiveSplit };

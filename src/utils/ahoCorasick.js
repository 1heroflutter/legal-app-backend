// ahoCorasick.js
// Triển khai cấu trúc dữ liệu Cây tiền tố (Trie) kết hợp Failure Links (thuật toán Aho-Corasick) 
// để tìm kiếm và trích xuất thực thể đa mẫu chỉ trong 1 lần duyệt tuyến tính duy nhất.

class AhoCorasickNode {
    constructor() {
        this.children = {};      // Các nút con (ký tự -> AhoCorasickNode)
        this.failureLink = null;  // Cung thất bại (Failure Link)
        this.output = [];        // Danh sách các từ khóa kết thúc tại nút này hoặc các nút thất bại của nó
    }
}

class AhoCorasickAutomaton {
    constructor() {
        this.root = new AhoCorasickNode();
    }

    /**
     * Thêm một từ khóa thực thể vào Trie
     * @param {string} keyword Từ khóa cần chèn
     */
    insert(keyword) {
        if (!keyword || typeof keyword !== 'string') return;
        const normalizedWord = keyword.toLowerCase().trim();
        if (!normalizedWord) return;

        let current = this.root;
        for (const char of normalizedWord) {
            if (!current.children[char]) {
                current.children[char] = new AhoCorasickNode();
            }
            current = current.children[char];
        }
        // Thêm từ khóa nguyên bản vào danh sách output của node kết thúc
        if (!current.output.includes(keyword)) {
            current.output.push(keyword);
        }
    }

    /**
     * Xây dựng các cung thất bại (Failure Links) và cung đầu ra (Output Links) bằng thuật toán BFS
     */
    buildFailureLinks() {
        const queue = [];

        // Bước 1: Các nút ở tầng 1 (con trực tiếp của root)
        // Tất cả failure links của tầng 1 đều trỏ về root
        for (const char in this.root.children) {
            const childNode = this.root.children[char];
            childNode.failureLink = this.root;
            queue.push(childNode);
        }

        // Bước 2: Duyệt BFS cho các tầng tiếp theo
        while (queue.length > 0) {
            const current = queue.shift();

            for (const char in current.children) {
                const childNode = current.children[char];
                queue.push(childNode);

                // Tìm failure link cho childNode
                let failureState = current.failureLink;
                while (failureState !== null && !failureState.children[char]) {
                    failureState = failureState.failureLink;
                }

                // Nếu tìm thấy node có nhánh đi tiếp, trỏ failure link tới đó, ngược lại trỏ về root
                childNode.failureLink = failureState ? failureState.children[char] : this.root;

                // Gộp danh sách output từ node thất bại vào node hiện tại để hỗ trợ trích xuất đầy đủ
                if (childNode.failureLink.output.length > 0) {
                    childNode.output = [...new Set([...childNode.output, ...childNode.failureLink.output])];
                }
            }
        }
    }

    /**
     * Tìm tất cả thực thể pháp luật xuất hiện trong đoạn văn bản
     * @param {string} text Đoạn văn bản đầu vào cần quét
     * @returns {Array<{word: string, index: number}>} Danh sách thực thể và vị trí của chúng
     */
    search(text) {
        if (!text) return [];
        const normalizedText = text.toLowerCase();
        const results = [];
        let current = this.root;

        for (let i = 0; i < normalizedText.length; i++) {
            const char = normalizedText[i];

            // Nếu không có đường đi cho ký tự hiện tại, đi theo failure link
            while (current !== null && !current.children[char]) {
                current = current.failureLink;
            }

            // Nếu quay về trước root (null), bắt đầu lại từ root
            if (current === null) {
                current = this.root;
                continue;
            }

            // Di chuyển tới node con tương ứng
            current = current.children[char];

            // Nếu node hiện tại chứa output (trùng khớp từ khóa)
            if (current.output.length > 0) {
                for (const word of current.output) {
                    // Tính chỉ số bắt đầu của từ khóa trong văn bản gốc
                    const startIndex = i - word.length + 1;
                    results.push({
                        word: word,
                        index: startIndex
                    });
                }
            }
        }

        return results;
    }
}

module.exports = { AhoCorasickAutomaton };

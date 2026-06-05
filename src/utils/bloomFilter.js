// bloomFilter.js
// Triển khai cấu trúc dữ liệu xác suất Bloom Filter sử dụng mảng Bit và nhiều hàm băm 
// để chặn đứng các truy vấn rác và spam-bot ngay ở lớp API gateway.

class BloomFilter {
    /**
     * @param {number} sizeInBits Số lượng bit trong bộ lọc (nếu dùng 256,000 bit sẽ tốn ~32KB RAM)
     * @param {number} numHashFunctions Số lượng hàm băm (K)
     */
    constructor(sizeInBits = 256000, numHashFunctions = 5) {
        this.sizeInBits = sizeInBits;
        this.numHashFunctions = numHashFunctions;
        
        // Sử dụng Uint8Array để lưu trữ mảng bit tối ưu bộ nhớ
        // Mỗi byte chứa 8 bit, nên kích thước Uint8Array là sizeInBits / 8
        const numBytes = Math.ceil(sizeInBits / 8);
        this.bitArray = new Uint8Array(numBytes);

        // Khởi tạo các hạt giống (seeds) cố định cho các hàm băm khác nhau để có tính nhất quán
        this.hashSeeds = [17, 31, 101, 223, 607, 1009, 2003, 4001].slice(0, numHashFunctions);
    }

    /**
     * Hàm băm FNV-1a 32-bit nhanh và phân phối đều
     * @param {string} str Chuỗi cần băm
     * @param {number} seed Hạt giống khởi tạo
     * @returns {number} Giá trị băm 32-bit không dấu
     */
    _fnv1a(str, seed) {
        let hash = seed;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            // Nhân với số nguyên tố FNV 32-bit và lấy số nguyên không dấu
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash;
    }

    /**
     * Thêm một từ vào Bloom Filter
     * @param {string} word Từ cần thêm
     */
    add(word) {
        if (!word) return;
        const normalized = word.toLowerCase().trim();
        if (!normalized) return;

        for (let i = 0; i < this.numHashFunctions; i++) {
            const seed = this.hashSeeds[i];
            const hashVal = this._fnv1a(normalized, seed);
            const bitIndex = hashVal % this.sizeInBits;
            
            const byteIndex = Math.floor(bitIndex / 8);
            const bitOffset = bitIndex % 8;
            
            // Đặt bit tại vị trí bitOffset trong byteIndex thành 1
            this.bitArray[byteIndex] |= (1 << bitOffset);
        }
    }

    /**
     * Kiểm tra xem một từ có tồn tại trong bộ lọc không
     * @param {string} word Từ cần kiểm tra
     * @returns {boolean} False nếu CHẮC CHẮN không tồn tại, True nếu CÓ THỂ tồn tại
     */
    contains(word) {
        if (!word) return false;
        const normalized = word.toLowerCase().trim();
        if (!normalized) return false;

        for (let i = 0; i < this.numHashFunctions; i++) {
            const seed = this.hashSeeds[i];
            const hashVal = this._fnv1a(normalized, seed);
            const bitIndex = hashVal % this.sizeInBits;
            
            const byteIndex = Math.floor(bitIndex / 8);
            const bitOffset = bitIndex % 8;
            
            // Kiểm tra bit tại vị trí tương ứng. Nếu bằng 0 thì chắc chắn từ này chưa bao giờ được thêm
            if ((this.bitArray[byteIndex] & (1 << bitOffset)) === 0) {
                return false;
            }
        }
        return true;
    }
}

module.exports = { BloomFilter };

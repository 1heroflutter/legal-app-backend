// dictionaryHelper.js
// Quản lý từ điển tiếng Việt cơ bản (cho Bloom Filter) và từ điển thực thể pháp lý (cho Aho-Corasick).
// Khởi tạo và cung cấp các instance toàn cục dùng chung cho toàn bộ hệ thống.

const { BloomFilter } = require('./bloomFilter');
const { AhoCorasickAutomaton } = require('./ahoCorasick');

// 1. Từ điển tiếng Việt thông dụng (dành cho Bloom Filter chặn spam)
// Bao gồm các từ giao tiếp cơ bản, từ chỉ thời gian, hành động, đại từ và thuật ngữ giao thông/pháp luật cơ bản.
const VIETNAMESE_BASIC_WORDS = [
    // Đại từ, giao tiếp
    "tôi", "bạn", "anh", "chị", "em", "ông", "bà", "nó", "chúng", "ta", "họ", "cháu", "con", "thầy",
    "chào", "xin", "cảm", "ơn", "cám", "lỗi", "phiền", "hỏi", "đáp", "tư", "vấn", "giúp", "đỡ", "hộ",
    "nói", "nghe", "biết", "cho", "nhận", "gửi", "lấy", "mang", "đưa", "đi", "đến", "về", "ra", "vào",
    "ở", "tại", "trong", "ngoài", "trên", "dưới", "trước", "sau", "giữa", "bên", "cạnh", "gần", "xa",
    
    // Từ để hỏi, trạng từ, liên từ
    "gì", "nào", "sao", "thế", "đâu", "ai", "khi", "bao", "nhiêu", "mấy", "hả", "ư", "nhé", "nha",
    "có", "không", "chưa", "rồi", "đang", "sẽ", "đã", "muốn", "cần", "phải", "được", "bị", "làm",
    "và", "hoặc", "nhưng", "vì", "nên", "nếu", "thì", "tuy", "dù", "rằng", "là", "như", "hơn", "nhất",
    
    // Số đếm, thời gian
    "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười", "trăm", "nghìn", "triệu",
    "ngày", "tháng", "năm", "giờ", "phút", "giây", "tuần", "quý", "lần", "đợt", "kỳ", "buổi", "sáng", "trưa", "chiều", "tối", "đêm",
    
    // Thuật ngữ pháp luật, hành chính, hình phạt
    "luật", "pháp", "định", "nghị", "thông", "tư", "điều", "khoản", "điểm", "bộ", "luật", "dân", "sự", "hình", "án", "tòa",
    "vi", "phạm", "phạt", "tiền", "tù", "giam", "treo", "cải", "tạo", "tịch", "thu", "bằng", "lái", "xe", "tước", "giữ",
    "phương", "tiện", "tạm", "quyết", "định", "biên", "bản", "cảnh", "sát", "giao", "thông", "công", "an", "thanh", "tra",
    "tội", "danh", "hành", "vi", "hậu", "quả", "nghiêm", "trọng", "nhẹ", "nặng", "giảm", "tăng", "tình", "tiết",
    "bản", "án", "tiền", "lệ", "án", "lệ", "trích", "dẫn", "nguồn", "cơ", "sở", "dữ", "liệu", "hồ", "sơ",
    
    // Giao thông, phương tiện
    "xe", "máy", "ô", "tô", "mô", "tô", "đạp", "điện", "tải", "khách", "container", "bus", "buýt", "taxi",
    "đường", "bộ", "phố", "lộ", "quốc", "đường", "cao", "tốc", "làn", "vạch", "kẻ", "biển", "báo", "hiệu", "đèn", "tín",
    "đội", "mũ", "bảo", "hiểm", "ngược", "chiều", "đỏ", "vàng", "xanh", "tốc", "độ", "quá", "tốc", "nồng", "độ", "cồn",
    "rượu", "bia", "uống", "say", "xỉn", "chất", "kích", "thích", "ma", "túy", "giấy", "phép", "đăng", "ký", "đăng", "kiểm",
    "bảo", "hiểm", "bắt", "buộc", "trách", "nhiệm", "dân", "sự", "chủ", "xe", "tai", "nạn", "gây", "đâm", "đụng", "va", "chạm",
    "lạng", "lách", "đánh", "võng", "đua", "xe", "trái", "phép", "bốc", "đầu", "kéo", "đẩy", "chở", "quá", "tải", "số", "người",
    
    // Một số từ phụ trợ tiếng Việt cực kỳ phổ biến khác
    "này", "kia", "đó", "ấy", "ấy", "nào", "mọi", "mỗi", "tất", "cả", "chỉ", "cũng", "còn", "quá", "rất", "lắm",
    "hết", "cực", "kỳ", "quá", "thật", "luôn", "ngay", "lập", "tức", "nhanh", "chậm", "sớm", "muộn", "đúng", "sai",
    "rõ", "ràng", "mơ", "hồ", "khó", "dễ", "tốt", "xấu", "mới", "cũ", "cao", "thấp", "dài", "ngắn"
];

// 2. Từ điển thực thể pháp lý (dành cho Aho-Corasick dán nhãn / trích xuất thực thể)
// Chứa các cụm thực thể pháp lý hoàn chỉnh liên quan đến lỗi giao thông và tội danh
const LEGAL_ENTITIES = [
    // Lỗi/Khái niệm giao thông đường bộ
    "nồng độ cồn",
    "án treo",
    "án lệ",
    "tiền lệ",
    "vượt đèn đỏ",
    "đi ngược chiều",
    "không đội mũ bảo hiểm",
    "giấy phép lái xe",
    "bằng lái xe",
    "chạy quá tốc độ",
    "lạng lách",
    "đánh võng",
    "đua xe trái phép",
    "gây tai nạn",
    "tai nạn giao thông",
    "đi sai làn đường",
    "đi sai làn",
    "không gương chiếu hậu",
    "hết hạn đăng kiểm",
    "đăng ký xe",
    "cà vẹt xe",
    "bảo hiểm xe",
    "chở quá số người",
    "chở quá tải",
    "đi vào đường cấm",
    "đi vào đường ngược chiều",
    "không chấp hành tín hiệu",
    
    // Tội danh/Thuật ngữ hình sự trong bản án lệ
    "trộm cắp tài sản",
    "trộm cắp",
    "cướp giật tài sản",
    "cướp giật",
    "lừa đảo chiếm đoạt tài sản",
    "lừa đảo",
    "lạm dụng tín nhiệm",
    "vi phạm quy định về tham gia giao thông",
    "vi phạm quy định giao thông",
    "cố ý gây thương tích",
    "chống người thi hành công vụ",
    "gây rối trật tự công cộng",
    "chứa chấp tài sản",
    "tiêu thụ tài sản",
    "vô ý làm chết người",
    "mua bán trái phép chất ma túy",
    "tàng trữ trái phép chất ma túy"
];

// Khai báo các instance toàn cục
let globalBloomFilter = null;
let globalAhoCorasick = null;

/**
 * Khởi tạo toàn bộ từ điển và nạp vào Bloom Filter + Aho-Corasick
 */
function initDictionaries() {
    console.log("📚 Khởi tạo từ điển hệ thống...");

    // 1. Tạo & nạp Bloom Filter
    // Sử dụng kích thước 256000 bits (~32KB) và 5 hàm băm
    globalBloomFilter = new BloomFilter(256000, 5);
    for (const word of VIETNAMESE_BASIC_WORDS) {
        globalBloomFilter.add(word);
    }
    // Nạp thêm cả các thực thể pháp lý vào Bloom Filter để đảm bảo từ chuyên ngành không bị chặn nhầm
    for (const entity of LEGAL_ENTITIES) {
        const words = entity.split(" ");
        for (const w of words) {
            globalBloomFilter.add(w);
        }
    }
    console.log(` ✅ Khởi tạo Bloom Filter thành công (Nạp ${VIETNAMESE_BASIC_WORDS.length + LEGAL_ENTITIES.length} từ khóa).`);

    // 2. Tạo & nạp Aho-Corasick Trie
    globalAhoCorasick = new AhoCorasickAutomaton();
    for (const entity of LEGAL_ENTITIES) {
        globalAhoCorasick.insert(entity);
    }
    globalAhoCorasick.buildFailureLinks();
    console.log(` ✅ Khởi tạo Aho-Corasick Trie thành công (Nạp ${LEGAL_ENTITIES.length} thực thể pháp lý).`);
}

/**
 * Kiểm tra xem một đoạn tin nhắn có phải là spam/rác hay không sử dụng Bloom Filter
 * @param {string} text Đoạn tin nhắn đầu vào
 * @returns {boolean} True nếu là spam, False nếu hợp lệ
 */
function checkIsSpam(text) {
    if (!text || typeof text !== 'string') return true;
    
    // Làm sạch câu hỏi và tách thành các từ đơn
    const cleanedText = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s{2,}/g, " ");
    const words = cleanedText.toLowerCase().split(" ").filter(w => w.trim().length > 0);
    
    if (words.length === 0) return true;
    
    // Nếu câu hỏi quá ngắn (ví dụ chỉ có 1-2 ký tự rác), Bloom Filter có thể khó đánh giá chuẩn.
    // Đối với chuỗi quá ngắn (< 3 ký tự), ta kiểm tra trực tiếp
    if (text.trim().length < 3) {
        // Nếu không thuộc danh sách từ đơn cơ bản thì chặn
        return !globalBloomFilter.contains(text.trim());
    }

    let nonExistentCount = 0;
    for (const word of words) {
        if (!globalBloomFilter.contains(word)) {
            nonExistentCount++;
        }
    }

    const spamRatio = nonExistentCount / words.length;
    console.log(`🛡️ [Bloom Filter Check] Spam Ratio: ${(spamRatio * 100).toFixed(1)}% (${nonExistentCount}/${words.length} từ không tồn tại).`);

    // Nếu hơn 70% số từ trong câu hỏi không nằm trong từ điển, khẳng định câu hỏi rác/spam
    // Ngưỡng 0.7 đảm bảo chịu lỗi tốt đối với các từ gõ sai chính tả nhẹ hoặc tên riêng của người dùng.
    return spamRatio > 0.7;
}

/**
 * Lấy danh sách thực thể pháp lý xuất hiện trong câu hỏi
 * @param {string} text Đoạn văn bản đầu vào
 * @returns {string[]} Danh sách các thực thể tìm thấy duy nhất
 */
function extractLegalEntities(text) {
    if (!text) return [];
    const searchResults = globalAhoCorasick.search(text);
    // Chỉ giữ lại danh sách các thực thể duy nhất
    const uniqueEntities = [...new Set(searchResults.map(r => r.word))];
    return uniqueEntities;
}

// Khởi chạy khởi tạo ngay khi load module
initDictionaries();

module.exports = {
    checkIsSpam,
    extractLegalEntities,
    getBloomFilter: () => globalBloomFilter,
    getAhoCorasick: () => globalAhoCorasick
};

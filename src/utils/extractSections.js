//extractSections.js

const normalize = (text) => {
    return text
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/[ ]{2,}/g, " ")
        .trim();
};

// Hàm tìm section với nhiều pattern hơn
const findSection = (text, keywords, options = {}) => {
    const { searchFromEnd = false, maxLength = 50000 } = options;
    
    // Nếu tìm từ cuối lên (cho phần QUYẾT ĐỊNH)
    if (searchFromEnd) {
        for (const keyword of keywords) {
            // Tìm keyword gần cuối text nhất
            const lastIndex = text.lastIndexOf(keyword);
            if (lastIndex !== -1) {
                return text.substring(
                    lastIndex, 
                    Math.min(lastIndex + maxLength, text.length)
                );
            }
        }
        return "";
    }
    
    // Tìm bình thường từ đầu
    for (const keyword of keywords) {
        const index = text.indexOf(keyword);
        if (index !== -1) {
            return text.substring(
                index, 
                Math.min(index + maxLength, text.length)
            );
        }
    }
    
    return "";
};

// Hàm tìm section QUYẾT ĐỊNH với nhiều pattern
const findQuyetDinhSection = (text) => {
    // Pattern 1: Tìm "QUYẾT ĐỊNH" hoặc biến thể
    const quyetDinhPatterns = [
        "QUYẾT ĐỊNH",
        "QUYẾT ÐỊNH", // Chữ D đặc biệt
        "QUYET DINH",
        "QUYẾT ĐỊNH CỦA TÒA ÁN",
        "QUYẾT ĐỊNH:",
        "QUYẾT ÐỊNH:",
        "Q U Y Ế T   Đ Ị N H",
        "QUYẾT-ĐỊNH"
    ];
    
    // Pattern 2: Tìm các cụm từ thường xuất hiện trong phần quyết định
    const decisionPhrases = [
        "TUYÊN BỐ",
        "XỬ PHẠT",
        "Tuyến bố",
        "Xử phạt",
        "Áp dụng",
        "Căn cứ vào",
        "VÌ CÁC LẼ TRÊN"
    ];
    
    // Thử tìm với pattern chính
    for (const pattern of quyetDinhPatterns) {
        const index = text.indexOf(pattern);
        if (index !== -1) {
            // Tìm từ vị trí này đến hết hoặc đến section khác
            const nextSectionIndex = findNextSectionIndex(text, index + pattern.length);
            if (nextSectionIndex !== -1) {
                return text.substring(index, nextSectionIndex);
            }
            return text.substring(index);
        }
    }
    
    // Nếu không tìm thấy pattern chính, thử tìm với phrase pattern
    for (const phrase of decisionPhrases) {
        const index = text.indexOf(phrase);
        if (index !== -1) {
            // Tìm section bắt đầu từ 500 ký tự trước phrase (có thể có "QUYẾT ĐỊNH" ở trước)
            const startIndex = Math.max(0, index - 500);
            const nextSectionIndex = findNextSectionIndex(text, index + phrase.length);
            if (nextSectionIndex !== -1) {
                return text.substring(startIndex, nextSectionIndex);
            }
            return text.substring(startIndex);
        }
    }
    
    return "";
};

// Tìm section tiếp theo (để biết điểm kết thúc)
const findNextSectionIndex = (text, startFrom) => {
    const sectionMarkers = [
        "NHẬN ĐỊNH",
        "XÉT THẤY",
        "Xét thấy",
        "QUYẾT ĐỊNH",
        "QUYẾT ÐỊNH"
    ];
    
    let minIndex = -1;
    for (const marker of sectionMarkers) {
        const index = text.indexOf(marker, startFrom);
        if (index !== -1 && (minIndex === -1 || index < minIndex)) {
            minIndex = index;
        }
    }
    
    return minIndex;
};

const extractSections = (rawText) => {
    const text = normalize(rawText);
    
    // Tìm phần QUYẾT ĐỊNH với nhiều pattern
    let quyet_dinh = findQuyetDinhSection(text);
    
    // Nếu không tìm thấy, thử tìm phần cuối cùng của bản án
    if (!quyet_dinh || quyet_dinh.length < 100) {
        // Lấy 5000 ký tự cuối cùng (thường là phần quyết định)
        const lastPart = text.substring(Math.max(0, text.length - 8000));
        quyet_dinh = findQuyetDinhSection(lastPart) || lastPart;
    }
    
    // Tìm phần NHẬN ĐỊNH
    const nhanDinhKeywords = [
        "NHẬN ĐỊNH",
        "NHẬN ÐỊNH",
        "XÉT THẤY",
        "Xét thấy",
        "XÉT THẤY:",
        "NHẬN THẤY"
    ];
    
    let nhan_dinh = "";
    for (const keyword of nhanDinhKeywords) {
        const index = text.indexOf(keyword);
        if (index !== -1) {
            // Tìm đến trước phần QUYẾT ĐỊNH (nếu có)
            const quyetDinhIndex = text.indexOf("QUYẾT ĐỊNH", index);
            if (quyetDinhIndex !== -1) {
                nhan_dinh = text.substring(index, quyetDinhIndex);
            } else {
                nhan_dinh = text.substring(index, Math.min(index + 15000, text.length));
            }
            break;
        }
    }
    
    // Log để debug
    console.log("📌 PHẦN QUYẾT ĐỊNH:", {
        found: !!quyet_dinh,
        length: quyet_dinh?.length || 0,
        preview: quyet_dinh?.substring(0, 200) + "..."
    });
    
    return {
        quyet_dinh: quyet_dinh || "",
        nhan_dinh: nhan_dinh || "",
        thong_tin: text.substring(0, 3000),
        full: text
    };
};

module.exports = { extractSections };
const { generateLegalConsultation } = require('../services/chatService');
const { checkIsSpam } = require('../utils/dictionaryHelper');

const chatWithAI = async (req, res) => {
    try {
        const { message } = req.body;
        console.log("📩 Nhận câu hỏi:", message);

        // 1. Validation cơ bản
        if (!message || message.trim() === "") {
            return res.status(400).json({
                error: "Dữ liệu không hợp lệ",
                message: "Vui lòng cung cấp nội dung câu hỏi (biến 'message')."
            });
        }

        // 2. Bảo vệ chống Spam/Query rác bằng Bloom Filter
        if (checkIsSpam(message)) {
            console.log("🛡️ [Bloom Filter Warning] Chặn đứng truy vấn rác/spam:", message);
            return res.status(400).json({
                error: "Phát hiện nội dung không hợp lệ hoặc spam",
                answer: "⚠️ Trợ lý ảo phát hiện câu hỏi của bạn chứa nhiều từ vô nghĩa hoặc có dấu hiệu spam. Bạn vui lòng đặt câu hỏi rõ ràng bằng tiếng Việt liên quan đến lĩnh vực Luật Giao thông đường bộ nhé!"
            });
        }

        const answer = await generateLegalConsultation(message);

        res.json({ answer });
    } catch (error) {
        console.error("❌ Lỗi Controller:", error.message);

        // Trả về lỗi thân thiện trực tiếp cho người dùng cuối
        res.status(500).json({
            error: "Đã có lỗi xảy ra",
            answer: "⚠️ Đã xảy ra lỗi kết nối với máy chủ AI. Hệ thống có thể đang quá tải hoặc gặp sự cố mạng tạm thời, bạn vui lòng thử lại sau ít phút nhé!"
        });
    }
};

module.exports = { chatWithAI };
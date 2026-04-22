const { generateLegalConsultation } = require('../services/chatService');

const chatWithAI = async (req, res) => {
    try {
        const { message } = req.body;
        console.log("📩 Nhận câu hỏi:", message);

        // Validation
        if (!message || message.trim() === "") {
            return res.status(400).json({
                error: "Dữ liệu không hợp lệ",
                message: "Vui lòng cung cấp nội dung câu hỏi (biến 'message')."
            });
        }

        const answer = await generateLegalConsultation(message);

        res.json({ answer });
    } catch (error) {
        // Log lỗi chi tiết ra console
        console.error("❌ Lỗi Controller:", error.message);

        // Trả về lỗi chi tiết cho client để debug
        res.status(500).json({
            error: "Đã có lỗi xảy ra",
            details: error.message
        });
    }
};

module.exports = { chatWithAI };
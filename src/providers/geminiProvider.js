const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider {
    constructor() {
        // Khởi tạo một lần đỡ tốn overhead
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }

    async generateConsultationResponse(context, userQuery) {
        console.log("🤖 [GeminiProvider] Đang khởi tạo prompt và gọi AI...");
        const prompt = `
            Bạn là chuyên gia tư vấn luật giao thông Việt Nam. 
            Dựa vào các tiền lệ sau:
            ${context}
            
            Tư vấn ngắn gọn cho: "${userQuery}"
            Yêu cầu: Trực diện, trích dẫn số bản án và điều luật.
        `;

        try {
            console.log("🤖 [GeminiProvider] Đang gọi Gemini.generateContent...");
            const result = await this.model.generateContent(prompt);
            const textResponse = result.response.text();
            console.log("✅ [GeminiProvider] Gemini phản hồi thành công.");
            return textResponse;
        } catch (error) {
            console.error("❌ Lỗi tại GeminiProvider.generateConsultationResponse:", error);
            throw new Error(`AI Error: ${error.message}`);
        }
    }
}

module.exports = new GeminiProvider();

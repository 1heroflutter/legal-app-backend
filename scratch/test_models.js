require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Lưu ý: SDK không có phương thức listModels trực tiếp trên genAI object 
    // mà phải dùng qua REST hoặc client khác, nhưng ta có thể thử gọi một cái tên chắc chắn đúng.
    
    const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-pro'];
    
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent("Hi");
        console.log(`✅ Model ${m} is working!`);
        break;
      } catch (e) {
        console.error(`❌ Model ${m} failed:`, e.message);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

listModels();

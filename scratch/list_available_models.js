require('dotenv').config();
const axios = require('axios');

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await axios.get(url);
        console.log("AVAILABLE MODELS:");
        response.data.models.forEach(m => {
            console.log(`- ${m.name}`);
        });
    } catch (err) {
        console.error("❌ FAILED TO LIST MODELS:", err.response?.data || err.message);
    }
}

listModels();

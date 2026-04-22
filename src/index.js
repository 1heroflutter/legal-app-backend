require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const { chatWithAI } = require('./controllers/chatController');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Bắt lỗi sập server (Crash) và ghi vào file để dễ debug
process.on('uncaughtException', (err) => {
    const msg = `\n[${new Date().toLocaleString()}] CRITICAL ERROR (Uncaught Exception):\n${err.stack || err}\n`;
    fs.appendFileSync(path.join(__dirname, '../system_error.log'), msg);
    console.error(msg);
    // Không gọi process.exit(1) để tránh server bị tắt khi lỗi có thể phục hồi
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = `\n[${new Date().toLocaleString()}] CRITICAL ERROR (Unhandled Rejection):\nReason: ${reason}\n`;
    fs.appendFileSync(path.join(__dirname, '../system_error.log'), msg);
    console.error(msg);
});

const app = express();
app.use(cors());
app.use(express.json());

// Route cho Chatbot
app.post('/api/chat', chatWithAI);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
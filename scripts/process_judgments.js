require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { extractText } = require('../src/services/ocrService');
const { parseJudgmentToJSON } = require('../src/services/aiService');
const { db } = require('../src/config/firebase'); 
const JUDGMENTS_DIR = path.join(__dirname, "../judgments_pdf");
// =============================
// CONFIG PRODUCTION
// =============================
const BASE_DELAY = 25000;        // 7 giây giữa mỗi file
const RETRY_DELAY = 30000;      // 15 giây nếu bị 429
const MAX_RETRIES = 3;

// =============================
// HELPER
// =============================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================
// RETRY WRAPPER CHỐNG 429
// =============================
async function callAIWithRetry(text, retries = 5, delay = 20000) {

  try {

    const result = await parseJudgmentToJSON(text);

    if (result) return result;

    throw new Error("Empty AI response");

  } catch (err) {

    if (retries <= 0) {

      console.log("❌ Retry hết số lần.");
      return null;
    }

    console.log(`⚠️ Retry sau ${delay/1000}s... (${retries} lần còn lại)`);

    await sleep(delay);

    return callAIWithRetry(text, retries - 1, delay * 1.5);
  }
}

// =============================
// XỬ LÝ 1 FILE
// =============================
async function processSingleFile(fileName) {

  const filePath = path.join(JUDGMENTS_DIR, fileName);

  console.log(`\n--- Đang xử lý: ${fileName} ---`);

  try {

    const rawText = await extractText(filePath);

    if (!rawText || rawText.trim().length < 100) {
      console.log("⚠️ Không trích xuất được text từ file.");
      return;
    }

    const structuredData = await callAIWithRetry(
      rawText.substring(0, 8000)
    );

    if (!structuredData) {
      console.log(`⚠️ AI không bóc tách được dữ liệu file: ${fileName}`);
      return;
    }

    console.log("✅ AI bóc tách thành công");

    const docId = structuredData.so_ban_an
      ? structuredData.so_ban_an.replace(/[\/\\]/g, "-")
      : path.parse(fileName).name;

    await db.collection("judgments").doc(docId).set({
      ...structuredData,
      file_name: fileName,
      created_at: new Date().toISOString()
    });

    console.log("🔥 Đã lưu Firestore:", docId);

  } catch (err) {

    console.error("❌ Lỗi xử lý file:", err.message);
  }
}

// =============================
// MAIN
// =============================
async function main() {

  try {

    const files = fs.readdirSync(JUDGMENTS_DIR)
      .filter(file => file.toLowerCase().endsWith(".pdf"));

    console.log(`Tìm thấy ${files.length} file PDF`);

    for (const file of files) {

      await processSingleFile(file);

      console.log(`⏳ Đợi ${BASE_DELAY/1000}s tránh rate limit...\n`);
      await sleep(BASE_DELAY);
    }

    console.log("\n🎉 HOÀN TẤT TOÀN BỘ!");

  } catch (err) {

    console.error("❌ Lỗi hệ thống:", err.message);
  }
}

main();
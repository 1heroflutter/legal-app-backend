const fs = require("fs");
const path = require("path");
const os = require("os");
const pdfParse = require("pdf-parse-fork");
const Tesseract = require("tesseract.js");
const pdfPoppler = require("pdf-poppler");

const extractText = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return "";

        const buffer = fs.readFileSync(filePath);

        // thử extract text thường
        const data = await pdfParse(buffer);
        let text = data.text || "";

        // nếu là scan
        if (text.trim().length < 200) {

            console.log(`[OCR] Phát hiện file scan: ${path.basename(filePath)}`);

            const outputDir = path.join(os.tmpdir(), "ocr");

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const opts = {
                format: "png",
                out_dir: outputDir,
                out_prefix: path.basename(filePath, ".pdf"),
                page: null
            };

            await pdfPoppler.convert(filePath, opts);

            const imageFiles = fs.readdirSync(outputDir)
                .filter(f => f.startsWith(path.basename(filePath, ".pdf")))
                .map(f => path.join(outputDir, f));

            let fullText = "";

            for (const img of imageFiles) {

                console.log(`[OCR] Đang OCR: ${img}`);

                const { data: { text } } =
                    await Tesseract.recognize(img, "vie");

                fullText += text + "\n";
            }

            text = fullText;
        }

        return text;

    } catch (err) {

        console.error("[OCR ERROR]:", err);

        return "";
    }
};

module.exports = { extractText };
const { extractSections } = require("./extractSections");
const fs = require('fs');
const path = require('path');

// Test với một file cụ thể
const testFile = process.argv[2] || "judgments_pdf/03_PHAM_KHAC_VU__260.pdf";

async function debug() {
    console.log("🔍 DEBUG EXTRACT SECTIONS");
    console.log("==========================");
    
    // Đọc file PDF
    const { extractText } = require("../services/ocrService");
    const text = await extractText(testFile);
    
    if (!text) {
        console.log("❌ Không đọc được text từ file");
        return;
    }
    
    // Extract sections
    const sections = extractSections(text);
    
    console.log("\n📊 KẾT QUẢ EXTRACT:");
    console.log("-------------------");
    console.log("✅ QUYẾT ĐỊNH length:", sections.quyet_dinh.length);
    console.log("✅ NHẬN ĐỊNH length:", sections.nhan_dinh.length);
    console.log("✅ THÔNG TIN length:", sections.thong_tin.length);
    
    console.log("\n📝 PREVIEW QUYẾT ĐỊNH:");
    console.log("----------------------");
    console.log(sections.quyet_dinh.substring(0, 1000));
    
    console.log("\n📝 5 DÒNG CUỐI CỦA QUYẾT ĐỊNH:");
    console.log("-------------------------------");
    const lines = sections.quyet_dinh.split('\n');
    console.log(lines.slice(-5).join('\n'));
}

debug().catch(console.error);
// docs配下の全 .md ファイルを docs/pdf/ にPDF変換するスクリプト
// 使い方:  node docs/tools/build-pdf.js
const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");

const docsDir = path.resolve(__dirname, "..");        // docs/
const outDir = path.join(docsDir, "pdf");             // docs/pdf/
const cssPath = path.join(__dirname, "pdf.css");      // スタイル

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// docs直下の .md を対象（tools/pdf配下は除外）
const mdFiles = fs
  .readdirSync(docsDir)
  .filter((f) => f.endsWith(".md"))
  .sort();

(async () => {
  for (const file of mdFiles) {
    const src = path.join(docsDir, file);
    const dest = path.join(outDir, file.replace(/\.md$/, ".pdf"));
    process.stdout.write(`変換中: ${file} ... `);
    const pdf = await mdToPdf(
      { path: src },
      {
        stylesheet: [cssPath],
        pdf_options: {
          format: "A4",
          margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
          printBackground: true,
        },
        launch_options: { args: ["--no-sandbox"] },
      }
    );
    if (pdf && pdf.content) {
      fs.writeFileSync(dest, pdf.content);
      console.log("OK ->", path.relative(docsDir, dest));
    } else {
      console.log("失敗");
    }
  }
  console.log("\n完了しました。出力先:", outDir);
  process.exit(0);
})().catch((e) => {
  console.error("エラー:", e);
  process.exit(1);
});

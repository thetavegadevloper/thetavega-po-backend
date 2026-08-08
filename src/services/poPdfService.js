const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("puppeteer");
const { buildPOHtml } = require("../templates/poTemplate");

function pdfRoot() {
  const root = path.resolve(process.cwd(), process.env.PDF_STORAGE_DIR || "storage/pdfs");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

async function renderPdfBuffer(po, { preview = false } = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    const html = buildPOHtml(po.toObject ? po.toObject() : po, { preview });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: "18mm", right: "12mm", bottom: "17mm", left: "12mm" },
      headerTemplate: `<div style="font-family:Courier New,monospace;font-size:8px;width:100%;text-align:right;padding:0 12mm;color:#333;">${po.documentHeading || "PURCHASE ORDER"}</div>`,
      footerTemplate: `<div style="font-family:Courier New,monospace;font-size:8px;width:100%;padding:0 12mm;display:flex;justify-content:space-between;color:#555;"><span>${po.company?.companyName || ""}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}

async function storeOfficialPdf(po, userId) {
  const buffer = await renderPdfBuffer(po, { preview: false });
  const version = Number(po.pdf?.version || 0) + 1;
  const filename = `${po.poNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}-R${po.revisionNo}-V${version}.pdf`;
  const fullPath = path.join(pdfRoot(), filename);
  fs.writeFileSync(fullPath, buffer);

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  po.pdf = {
    version,
    storageKey: filename,
    generatedAt: new Date(),
    generatedBy: userId,
    hash
  };
  await po.save();
  return { buffer, filename, hash, version, fullPath };
}

function getStoredPdfPath(storageKey) {
  if (!storageKey) return null;
  const full = path.join(pdfRoot(), path.basename(storageKey));
  return fs.existsSync(full) ? full : null;
}

module.exports = { renderPdfBuffer, storeOfficialPdf, getStoredPdfPath };

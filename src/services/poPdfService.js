const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("puppeteer");
const { buildPOHtml } = require("../templates/poTemplate");

let browserPromise = null;

// =====================================================
// PDF ROOT
// =====================================================
function pdfRoot() {
  const root = path.resolve(
    process.cwd(),
    process.env.PDF_STORAGE_DIR || "storage/pdfs"
  );

  fs.mkdirSync(root, {
    recursive: true,
  });

  return root;
}

// =====================================================
// REUSE ONE PUPPETEER BROWSER
// =====================================================
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,

        executablePath:
          puppeteer.executablePath(),

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }

  const browser = await browserPromise;

  if (!browser.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }

  return browser;
}

// =====================================================
// RENDER PDF
// =====================================================
async function renderPdfBuffer(
  po,
  { preview = false } = {}
) {
  const startTime = Date.now();

  const browser =
    await getBrowser();

  const page =
    await browser.newPage();

  try {
    const html =
      buildPOHtml(
        po.toObject
          ? po.toObject()
          : po,
        { preview }
      );

    // Faster than networkidle0.
    // Good if your PDF HTML does not depend on
    // slow external web resources.
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Wait for any fonts used by the document.
    await page.evaluate(async () => {
      if (
        document.fonts &&
        document.fonts.ready
      ) {
        await document.fonts.ready;
      }
    });

    const buffer =
      await page.pdf({
        format: "A4",

        printBackground: true,

        displayHeaderFooter: true,

        margin: {
          top: "18mm",
          right: "12mm",
          bottom: "17mm",
          left: "12mm",
        },

        headerTemplate: `
          <div style="
            font-family:Courier New,monospace;
            font-size:8px;
            width:100%;
            text-align:right;
            padding:0 12mm;
            color:#333;
          ">
            ${po.documentHeading || "PURCHASE ORDER"}
          </div>
        `,

        footerTemplate: `
          <div style="
            font-family:Courier New,monospace;
            font-size:8px;
            width:100%;
            padding:0 12mm;
            display:flex;
            justify-content:space-between;
            color:#555;
          ">
            <span>
              ${po.company?.companyName || ""}
            </span>

            <span>
              Page
              <span class="pageNumber"></span>
              of
              <span class="totalPages"></span>
            </span>
          </div>
        `,
      });

    console.log(
      `[PDF] Generated ${po.poNumber} in ${
        Date.now() - startTime
      } ms`
    );

    return Buffer.from(buffer);

  } catch (error) {
    console.error(
      "[PDF] Generation failed:",
      error
    );

    throw error;

  } finally {
    // Close page only.
    // DO NOT close Chrome after every PDF.
    await page.close().catch(() => {});
  }
}

// =====================================================
// STORE OFFICIAL PDF
// =====================================================
async function storeOfficialPdf(
  po,
  userId
) {
  const buffer =
    await renderPdfBuffer(
      po,
      {
        preview: false,
      }
    );

  const version =
    Number(
      po.pdf?.version || 0
    ) + 1;

  const filename =
    `${po.poNumber.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )}-R${po.revisionNo}-V${version}.pdf`;

  const fullPath =
    path.join(
      pdfRoot(),
      filename
    );

  fs.writeFileSync(
    fullPath,
    buffer
  );

  const hash =
    crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

  po.pdf = {
    version,
    storageKey:
      filename,
    generatedAt:
      new Date(),
    generatedBy:
      userId,
    hash,
  };

  await po.save();

  return {
    buffer,
    filename,
    hash,
    version,
    fullPath,
  };
}

// =====================================================
// GET STORED PDF
// =====================================================
function getStoredPdfPath(
  storageKey
) {
  if (!storageKey) {
    return null;
  }

  const full =
    path.join(
      pdfRoot(),
      path.basename(
        storageKey
      )
    );

  return fs.existsSync(full)
    ? full
    : null;
}

module.exports = {
  renderPdfBuffer,
  storeOfficialPdf,
  getStoredPdfPath,
  getBrowser,
};
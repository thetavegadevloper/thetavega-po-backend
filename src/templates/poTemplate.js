const escapeHtml = require("../utils/escapeHtml");

// =====================================================
// DATE FORMAT
// =====================================================
function fmtDate(value) {
  if (!value) return "";

  const d = new Date(value);

  return `${String(d.getDate()).padStart(2, "0")}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${d.getFullYear()}`;
}

// =====================================================
// MONEY FORMAT
// =====================================================
function money(value) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

// =====================================================
// NORMAL ADDRESS
// Used for Vendor / Delivery Address
// =====================================================
function addressText(address = {}) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.district,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");
}

// =====================================================
// COMPANY HEADER ADDRESS
// State and Country intentionally removed
// Example:
// Block No.:02, Sadafulli, Rana Nagar,
// Chhatrapati Sambhajinagar, 431001
// =====================================================
function companyAddressText(address = {}) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.district,
    address.pincode,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");
}

// =====================================================
// CHARGE LABEL
// =====================================================
function chargeLabel(mode, value) {
  if (mode === "At Actual") return "@ ACTUAL";

  if (mode === "Inclusive") return "INCLUSIVE";

  if (mode === "Percent") {
    return `${Number(value || 0)} %`;
  }

  if (mode === "Fixed") {
    return `INR ${money(value)}`;
  }

  return escapeHtml(mode || "");
}

function renderHighlightedText(text = "", highlights = []) {
  let safeText = escapeHtml(text);

  if (!Array.isArray(highlights) || highlights.length === 0) {
    return safeText;
  }

  // Longer phrases first so smaller phrases do not break them
  const sortedHighlights = [...highlights]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  sortedHighlights.forEach((highlight) => {
    const safeHighlight = escapeHtml(highlight);

    // Escape special regex characters
    const escapedPattern = safeHighlight.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(`(${escapedPattern})`, "gi");

    safeText = safeText.replace(
      regex,
      "<strong>$1</strong>"
    );
  });

  return safeText;
}

// =====================================================
// RENDER TERMS
// =====================================================
function renderTerms(terms = []) {
  return terms
    .slice()
    .sort(
      (a, b) =>
        Number(a.displayOrder || 0) -
        Number(b.displayOrder || 0)
    )
    .map(
      (term, index, arr) => `
    <div class="term-row ${
      index === arr.length - 1 ? "last-term-row" : ""
    }">

          <strong class="term-title">
            ${escapeHtml(term.displayOrder || index + 1)}.
            ${escapeHtml(term.title)}:
          </strong>

          <span class="term-text">
            ${renderHighlightedText(
              term.text,
              term.highlights || []
            )}
          </span>

        </div>
      `
    )
    .join("");
}

function renderSpecificTerms(terms = []) {
  return terms
    .slice()
    .sort(
      (a, b) =>
        Number(a.displayOrder || 0) -
        Number(b.displayOrder || 0)
    )
    .map(
      (term, index) => `
        <tr>
          <td>
            <strong class="term-title">
              ${escapeHtml(term.displayOrder || index + 1)}.
              ${escapeHtml(term.title)}:
            </strong>

            <span class="term-text">
              ${renderHighlightedText(
                term.text,
                term.highlights || []
              )}
            </span>
          </td>
        </tr>
      `
    )
    .join("");
}

// =====================================================
// BUILD PURCHASE ORDER HTML
// =====================================================
function buildPOHtml(po, { preview = false } = {}) {
  const company = po.company || {};
  const vendor = po.vendor || {};
  const delivery = po.delivery || {};
  const project = po.project || {};
  const header = po.header || {};
  const charges = po.charges || {};
  const totals = po.totals || {};

  // ===================================================
  // SPECIFIC PO TERMS
  //
  // IMPORTANT:
  // Use the exact text saved in the PO.
  // Packing & Forwarding and Freight Charges
  // are NOT overwritten from charges.
  // ===================================================
  const specificTerms = (po.specificTerms || []).map((t) => ({
    ...t,
  }));

  // ===================================================
  // PREVIEW WATERMARK
  // ===================================================
  const previewMark = preview
    ? `
      <div class="watermark">
        PREVIEW - ${escapeHtml(po.status)}
      </div>
    `
    : "";

  const items = po.items || [];

  const itemRowHeight = Math.max(
    55,
    Math.floor(180 / Math.max(items.length, 1))
  );

  // ===================================================
  // HTML
  // ===================================================
  return `
<!doctype html>

<html>

<head>

<meta charset="utf-8" />

<title>
  PO ${escapeHtml(po.poNumber)}
</title>

<style>

  /* ===================================================
     GLOBAL
  =================================================== */

  * {
    box-sizing: border-box;
  }

  body {
    font-family: "Courier New", monospace;
    font-size: 12px;
    color: #111;
    margin: 0;
    padding: 0;
  }

  .page {
    width: 100%;
  }

  .box {
    width: 100%;
      border: 0;
  }
      .company,
.title,
.grid2,
.intro,
.items,
.totals,
.words,
.note,
.empty-row,
.section-heading,
.signatory,
.vendor-note,
.end {
  border-left: 1px solid #111;
  border-right: 1px solid #111;
}



  /* ===================================================
     COMPANY HEADER
  =================================================== */

  .company {
    text-align: center;
    padding: 7px 8px;
    line-height: 1.35;
    border-top: 1px solid #111;
  }

  .company h1 {
    font-size: 18px;
    margin: 0 0 2px 0;
    font-weight: 700;
  }

  /* ===================================================
     PURCHASE ORDER TITLE
  =================================================== */

  .title {
    text-align: center;

    border-top: 1px solid #111;
    border-bottom: 1px solid #111;

    padding: 5px;

    font-weight: 700;
    font-size: 11px;
  }

  /* ===================================================
     TWO COLUMN GRID
  =================================================== */

  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .cell {
    padding: 5px;

    border-right: 1px solid #111;
    border-bottom: 1px solid #111;

    line-height: 1.35;
  }

  .grid2 .cell:nth-child(2n) {
    border-right: 0;
  }

  /* ===================================================
     DATE AND ORDER NUMBER

     Separate horizontal row.
  =================================================== */

  .date-order .cell {
    min-height: 30px;

    padding: 6px 7px;

    display: flex;
    align-items: center;

    font-weight: 700;
  }

  /* ===================================================
     VENDOR + DELIVERY DETAILS

     Entire section bold as requested.
  =================================================== */

  .party-details .cell {
    min-height: 108px;

    font-weight: 700;

    padding: 7px;

    line-height: 1.45;
  }

  /* ===================================================
     QUOTE + PROJECT REFERENCE

     Entire section bold as requested.
  =================================================== */

  .reference .cell {
    min-height: 72px;

    font-weight: 700;

    padding: 7px;

    line-height: 1.45;
  }

  /* ===================================================
     INTRO
  =================================================== */

  .intro {
    padding: 6px;

    border-bottom: 1px solid #111;

    line-height: 1.35;
     font-weight: 700;
  }

  /* ===================================================
     TABLE
  =================================================== */

  table {
    width: 100%;

    border-collapse: collapse;

    border-spacing: 0;
  }

  /*
    Fixed layout makes the column percentages
    remain consistent in the PDF.
  */

  .items {
    width: 100%;
    table-layout: fixed;
  }

  .totals {
    width: 100%;
    table-layout: fixed;
  }

  thead {
    display: table-header-group;
  }

  tr {
    page-break-inside: avoid;
  }

  th,
  td {
    border-right: 1px solid #111;
    border-bottom: 1px solid #111;

    padding: 9px 8px;

    vertical-align: top;
     font-weight: 700;

    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  th:last-child,
  td:last-child {
    border-right: 0;
  }

  th {
    text-align: center;

    font-weight: 800;

    vertical-align: middle;
  }

.items td {
  vertical-align: middle;
  padding: 6px 8px;
}

  /* ===================================================
     ALIGNMENTS
  =================================================== */

  .num {
    text-align: right;

    white-space: nowrap;
  }

  .center {
    text-align: center;
  }

  /* ===================================================
     TOTALS
  =================================================== */

  .totals td {
    padding: 4px 5px;
  }

  .totals .label {
    text-align: right;

    font-weight: 700;
  }

  /* ===================================================
     AMOUNT IN WORDS
  =================================================== */

  .words {
    display: grid;

    grid-template-columns: 120px 1fr;

    border-bottom: 1px solid #111;
  }

  .words > div {
    padding: 5px;
  }

  .words > div:first-child {
    border-right: 1px solid #111;

    text-align: center;

    font-weight: 700;
  }

  /* ===================================================
     NOTES
  =================================================== */

  .note {
    padding: 5px;
 font-weight: 700;
    border-bottom: 1px solid #111;
  }

  /* ===================================================
     TERMS
  =================================================== */

.section-heading {
  padding: 7px 5px;

  border-left: 1px solid #111;
  border-right: 1px solid #111;
  border-top: 0;
  border-bottom: 0;

  font-weight: 700;
}

.term-text strong {
  font-weight: 700;
}
.specific-terms-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.specific-terms-table tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

.specific-terms-table td {
  padding: 6px 5px;

  border: 1px solid #111;

  line-height: 1.345;

  vertical-align: top;

  /* override your global td font-weight: 700 */
  font-weight: 400;
}

.specific-terms-table .term-title {
  font-weight: 700;
}

.specific-terms-table .term-text strong {
  font-weight: 700;
}

.term-row {
  padding: 6px 5px;

  border-bottom: 1px solid #111;

  line-height: 1.345;

  page-break-inside: avoid;
  break-inside: avoid;
}



  .term-row strong {
    margin-right: 4px;
  }

.empty-row {
  height: 28px;
  border-bottom: 1px solid #111;
}

  /* ===================================================
     SIGNATORY
  =================================================== */

  .signatory {
    min-height: 100px;

    padding: 8px 5px;

    line-height: 1.5;

    page-break-inside: avoid;
  }

  /* ===================================================
     VENDOR NOTE
  =================================================== */

  .vendor-note {
    border-top: 1px solid #111;

    padding: 7px 5px;

    line-height: 1.5;

    page-break-inside: avoid;
  }

  /* ===================================================
     END OF ORDER
  =================================================== */

  .end {
   text-align: center;
  font-weight: 700;
  padding: 9px;

  border-top: 1px solid #111;
  border-bottom: 1px solid #111;

  page-break-inside: avoid;
  break-inside: avoid;
  }

  /* ===================================================
     GENERAL TERMS
  =================================================== */

  .general {
    .general {
  page-break-before: auto;
  break-before: auto;
  margin-top: 12px;
}
  }

  .general-title {
    text-align: center;

    font-weight: 700;

    margin: 6px 0 14px;

    line-height: 1.5;
  }

  .general-intro {
    line-height: 1.5;

    margin-bottom: 14px;
  }

  .general .term-row {
    border: 0;

    padding: 5px 0;
  }



  .muted {
    color: #444;
  }

</style>

</head>

<body>

${previewMark}

<!-- ===================================================
     PURCHASE ORDER PAGE
=================================================== -->

<div class="page box">

  <!-- =================================================
       COMPANY HEADER
  ================================================= -->

  <div class="company">

    <h1>
      ${escapeHtml(company.companyName)}
    </h1>

    <!--
      State Maharashtra and Country India
      are intentionally NOT displayed here.
    -->

    <div>
      ${companyAddressText(company.registeredAddress)}
    </div>

    <div>
      Contact No: ${escapeHtml(company.contactNo)}
      &nbsp;&nbsp;

      Email: ${escapeHtml(company.email)}
      &nbsp;&nbsp;

      Web: ${escapeHtml(company.website)}
    </div>

    <div>
      GSTIN: ${escapeHtml(company.gstin)}
      &nbsp;&nbsp;

      State Code: ${escapeHtml(company.stateCode)}
      &nbsp;&nbsp;

      GST State: ${escapeHtml(company.gstState)}
    </div>

    <div>
      PAN NO: ${escapeHtml(company.pan)}
      &nbsp;&nbsp;

      CIN: ${escapeHtml(company.cin)}
    </div>

  </div>

  <!-- =================================================
       PURCHASE ORDER TITLE
  ================================================= -->

  <div class="title">
    PURCHASE ORDER
  </div>

  <!-- =================================================
       DATE + ORDER NUMBER
  ================================================= -->

  <div class="grid2 date-order">

    <div class="cell">

      <strong>Date:</strong>

      &nbsp;

      ${fmtDate(po.poDate)}

    </div>

    <div class="cell">

      <strong>Order No.:</strong>

      &nbsp;

      ${escapeHtml(po.poNumber)}

      ${
        po.revisionNo
          ? ` / Rev ${escapeHtml(po.revisionNo)}`
          : ""
      }

    </div>

  </div>

  <!-- =================================================
       VENDOR + DELIVERY ADDRESS
  ================================================= -->

  <div class="grid2 party-details">

    <div class="cell">

      <strong>
        Vendor Code:
      </strong>

      ${escapeHtml(vendor.vendorCode)}

      <br/>

      <strong>
        ${escapeHtml(vendor.vendorName)}
      </strong>

      <br/>

      ${addressText(vendor.registeredAddress)}

      <br/>

      <strong>
        GST NO:
      </strong>

      ${escapeHtml(vendor.gstNo)}

      <br/>

      <strong>
        PAN:
      </strong>

      ${escapeHtml(vendor.panNo)}

    </div>

    <div class="cell">

      <strong>
        Delivery Address:
      </strong>

      <br/>

      ${addressText(delivery.registeredAddress)}

      <br/>

      <strong>
        Email:
      </strong>

      ${escapeHtml(delivery.email)}

      <br/>

      <strong>
        Contact No.:
      </strong>

      ${escapeHtml(delivery.storeContactNo)}

      <br/>

      <strong>
        Contact Name:
      </strong>

      ${escapeHtml(delivery.storePersonName)}

    </div>

  </div>

  <!-- =================================================
       QUOTE + PROJECT DETAILS
  ================================================= -->

  <div class="grid2 reference">

    <div class="cell">

      <strong>
        Quote Ref Document No.:
      </strong>

      ${escapeHtml(header.quoteRefDocumentNo || "-")}

      <br/>

      <strong>
        Doc.Type:
      </strong>

      ${escapeHtml(header.documentType || "-")}

      <br/>

      <strong>
        Confirmed by:
      </strong>

      ${escapeHtml(header.confirmedBy || "-")}

    </div>

    <div class="cell">

      <strong>
        Thetavega Project Id:
      </strong>

      ${escapeHtml(project.projectCode || "-")}

      <br/>

      <strong>
        Project Document No:
      </strong>

      ${escapeHtml(
        header.projectDocumentNo ||
          project.projectDocumentNo ||
          "-"
      )}

      <br/>

      <strong>
        Ref.No.:
      </strong>

      ${escapeHtml(header.referenceNo || "-")}

      <br/>

      <strong>
        PAYMENT:
      </strong>

    ${escapeHtml(
        po.paymentTerm?.paymentName ||
        po.paymentTerm?.paymentSummary ||
        header.paymentSummary ||
        "-"
      )}

    </div>

  </div>

  <!-- =================================================
       INTRODUCTION
  ================================================= -->

  <div class="intro">

    Dear Sir,

    <br/>

    Please Supply material in accordance with Terms and Conditions
    as mentioned herein / printed overleaf.

    <br/>

    Kindly Acknowledge.

  </div>

  <!-- =================================================
       MATERIAL ITEM TABLE
  ================================================= -->

  <table class="items">

    <thead>

      <tr>

        <th style="width:5%">
          Sr.<br/>No
        </th>

        <th style="width:14%">
          Material<br/>Code
        </th>

        <th style="width:30%">
          Material Description
        </th>

        <th style="width:8%">
          HSN
        </th>

        <th style="width:7%">
          Unit
        </th>

        <th style="width:6%">
          Qty
        </th>

        <th style="width:14%">
          Rate (${escapeHtml(po.currency)})
        </th>

        <th style="width:16%">
          Total Amount
          <br/>
          (${escapeHtml(po.currency)})
        </th>

      </tr>

    </thead>

    <tbody>

     ${items
  .map(
    (item) => `
      <tr style="height:${itemRowHeight}px;">

          <td class="center">
            ${escapeHtml(item.srNo)}
          </td>

          <td>
            ${escapeHtml(item.materialCode)}
          </td>

          <td>
            ${escapeHtml(item.description || "").replaceAll(
              "\n",
              "<br/>"
            )}
          </td>

          <td class="center">
            ${escapeHtml(item.hsnSac)}
          </td>

          <td class="center">
            ${escapeHtml(item.uom)}
          </td>

          <td class="num">
            ${escapeHtml(item.qty)}
          </td>

          <td class="num">
            ₹ ${money(item.rate)}
          </td>

          <td class="num">
            ₹ ${money(item.basicAmount)}
          </td>

        </tr>

      `
        )
        .join("")}

    </tbody>

  </table>

  <!-- =================================================
       TOTALS
  ================================================= -->

  <table class="totals">

    <tr>

      <td class="label">
        SUB TOTAL
      </td>

      <td
        class="num"
        style="width:16%"
      >
        ₹ ${money(totals.subTotal)}
      </td>

    </tr>

    ${
      Number(totals.taxTotal || 0) !== 0
        ? `
          <tr>

            <td class="label">
              TAX TOTAL
            </td>

            <td class="num">
              ₹ ${money(totals.taxTotal)}
            </td>

          </tr>
        `
        : ""
    }

    ${
      Number(charges.packingAmount || 0) !== 0
        ? `
          <tr>

            <td class="label">
              PACKING
            </td>

            <td class="num">
              ₹ ${money(charges.packingAmount)}
            </td>

          </tr>
        `
        : ""
    }

    ${
      Number(charges.freightAmount || 0) !== 0
        ? `
          <tr>

            <td class="label">
              FREIGHT
            </td>

            <td class="num">
              ₹ ${money(charges.freightAmount)}
            </td>

          </tr>
        `
        : ""
    }

    <tr>

      <td class="label">
        ROUNDING OFF
      </td>

      <td class="num">
        ₹ ${money(totals.roundingOff)}
      </td>

    </tr>

    <tr>

      <td class="label">
        TOTAL
      </td>

      <td class="num">

        <strong>
          ₹ ${money(totals.grandTotal)}
        </strong>

      </td>

    </tr>

  </table>

  <!-- =================================================
       AMOUNT IN WORDS
  ================================================= -->

  <div class="words">

    <div>
      IN WORDS:
    </div>

    <div>

      <strong>
        ${escapeHtml(totals.amountInWords)}
      </strong>

    </div>

  </div>

  <!-- =================================================
       TAXES
  ================================================= -->

  <div class="note">

    <strong>
      TAXES & DUTIES:
    </strong>

    ${escapeHtml(header.taxesDutiesText)}

  </div>

  ${
    header.supplierTaxNote
      ? `
        <div class="note">
          ${escapeHtml(header.supplierTaxNote)}
        </div>
      `
      : ""
  }

  <!-- =================================================
       SPECIFIC TERMS
  ================================================= -->

<div class="empty-row"></div>

  <div class="section-heading">
    Supply Terms & Conditions :
  </div>

<table class="specific-terms-table">
  <tbody>
    ${renderSpecificTerms(specificTerms)}
  </tbody>
</table>

  <!-- =================================================
       SIGNATORY
  ================================================= -->

  <div class="signatory">

    <strong>
      FOR ${escapeHtml(company.companyName)}
    </strong>

    <br/>

    Contact Buyer:
    ${escapeHtml(header.buyerName)}

    &nbsp;

    ${escapeHtml(header.buyerContact)}

    <br/>
    <br/>
    <br/>

    <strong>
      ${escapeHtml(
        header.authorizedSignatory ||
          company.authorizedSignatoryText ||
          "AUTHORISED SIGNATORY"
      )}
    </strong>

  </div>

  <!-- =================================================
       NOTE TO VENDOR
  ================================================= -->

  <div class="vendor-note">

    <strong>
      Note to Vendor
    </strong>

    <br/>

    This Purchase Order is issued subject to
    ${escapeHtml(company.companyName)}'s General Terms and
    Conditions of Purchase, which form an integral part of
    this order.

    <br/>

    Vendor is advised to carefully review and comply with
    the Terms and Conditions applicable to the respective
    supply or service.

  </div>

  <!-- =================================================
       END
  ================================================= -->

  <div class="end">
    END OF ORDER
  </div>

</div>

<!-- =====================================================
     GENERAL TERMS AND CONDITIONS
===================================================== -->

<div class="general">

  <div class="general-title">

    ${escapeHtml(company.companyName)}

    <br/>

    PURCHASE ORDER - GENERAL TERMS & CONDITIONS

  </div>

  <div class="general-intro">

    All vendors/suppliers are required to comply with the
    following Terms and Conditions, as applicable to their
    respective products and services.

    <br/>

    In case of any deviations, objections, or clarifications,
    the vendor must notify
    ${escapeHtml(company.companyName)}
    in writing within 2 working days of receiving the
    Purchase Order.

    <br/>

    Failure to do so shall be deemed as acceptance of the
    terms and conditions mentioned herein.

  </div>

  ${renderTerms(po.generalTerms || [])}

</div>

</body>

</html>
`;
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  buildPOHtml,
};
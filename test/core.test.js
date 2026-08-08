const test = require("node:test");
const assert = require("node:assert/strict");

const getFinancialYear = require("../src/utils/financialYear");
const { amountInWords } = require("../src/utils/indianAmountInWords");
const { calculatePO } = require("../src/services/poCalculationService");

test("financial year changes on 1 April", () => {
  assert.equal(getFinancialYear(new Date("2026-03-31T12:00:00Z")), "2025-26");
  assert.equal(getFinancialYear(new Date("2026-04-01T12:00:00Z")), "2026-27");
});

test("sample PO amount is calculated exactly", () => {
  const result = calculatePO({
    currency: "INR",
    items: [
      {
        materialCode: "1002501251/001",
        description: "YLP 30W FIBER LASER SOURCE YLP 30V2 series",
        uom: "Set",
        qty: 6,
        rate: 337000,
        gstPercent: 0,
        tdsPercent: 0
      }
    ],
    charges: { packingMode: "At Actual", freightMode: "At Actual" },
    roundingOff: 0
  });

  assert.equal(result.totals.subTotal, 2022000);
  assert.equal(result.totals.grandTotal, 2022000);
  assert.equal(result.totals.amountInWords, "INR TWENTY LAKH TWENTY TWO THOUSAND ONLY");
});

test("GST, fixed charge and percentage charge are calculated", () => {
  const result = calculatePO({
    currency: "INR",
    items: [{ materialCode: "TEST", description: "Test", uom: "Nos", qty: 2, rate: 100, gstPercent: 18 }],
    charges: { packingMode: "Fixed", packingValue: 10, freightMode: "Percent", freightValue: 5 }
  });

  assert.equal(result.totals.subTotal, 200);
  assert.equal(result.totals.taxTotal, 36);
  assert.equal(result.charges.packingAmount, 10);
  assert.equal(result.charges.freightAmount, 10);
  assert.equal(result.totals.grandTotal, 256);
});

test("invalid quantity is rejected", () => {
  assert.throws(
    () => calculatePO({ items: [{ materialCode: "X", description: "X", uom: "Nos", qty: 0, rate: 10 }] }),
    /qty must be > 0/
  );
});

test("Indian amount in words supports paise", () => {
  assert.equal(amountInWords(125.5, "INR"), "INR ONE HUNDRED TWENTY FIVE AND FIFTY PAISE ONLY");
});

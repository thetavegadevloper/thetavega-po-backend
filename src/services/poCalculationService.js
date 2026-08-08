const ApiError = require("../utils/ApiError");
const { amountInWords } = require("../utils/indianAmountInWords");

const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function chargeAmount(mode, value, subTotal) {
  if (mode === "Fixed") return money(value || 0);
  if (mode === "Percent") return money((subTotal * Number(value || 0)) / 100);
  return 0;
}

function calculatePO({ items, charges = {}, roundingOff = 0, currency = "INR" }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "At least one PO item is required");
  }

  const calculatedItems = items.map((item, index) => {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const gstPercent = Number(item.gstPercent || 0);
    const tdsPercent = Number(item.tdsPercent || 0);

    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, `Item ${index + 1}: qty must be > 0`);
    if (!Number.isFinite(rate) || rate < 0) throw new ApiError(400, `Item ${index + 1}: rate must be >= 0`);
    if (gstPercent < 0 || gstPercent > 100) throw new ApiError(400, `Item ${index + 1}: GST must be 0-100`);
    if (tdsPercent < 0 || tdsPercent > 100) throw new ApiError(400, `Item ${index + 1}: TDS must be 0-100`);

    const basicAmount = money(qty * rate);
    const gstAmount = money((basicAmount * gstPercent) / 100);

    return {
      ...item,
      srNo: Number(item.srNo || (index + 1) * 10),
      qty,
      rate: money(rate),
      gstPercent,
      tdsPercent,
      basicAmount,
      gstAmount
    };
  });

  const subTotal = money(calculatedItems.reduce((sum, item) => sum + item.basicAmount, 0));
  const taxTotal = money(calculatedItems.reduce((sum, item) => sum + item.gstAmount, 0));

  const packingMode = charges.packingMode || "At Actual";
  const freightMode = charges.freightMode || "At Actual";
  const packingValue = Number(charges.packingValue || 0);
  const freightValue = Number(charges.freightValue || 0);
  const packingAmount = chargeAmount(packingMode, packingValue, subTotal);
  const freightAmount = chargeAmount(freightMode, freightValue, subTotal);
  const rounded = money(roundingOff || 0);
  const grandTotal = money(subTotal + taxTotal + packingAmount + freightAmount + rounded);

  return {
    items: calculatedItems,
    charges: {
      packingMode,
      packingValue,
      packingAmount,
      freightMode,
      freightValue,
      freightAmount
    },
    totals: {
      subTotal,
      taxTotal,
      roundingOff: rounded,
      grandTotal,
      amountInWords: amountInWords(grandTotal, currency)
    }
  };
}

module.exports = { calculatePO, money };

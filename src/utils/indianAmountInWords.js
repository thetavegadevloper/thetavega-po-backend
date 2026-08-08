const ONES = [
  "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
  "SEVENTEEN", "EIGHTEEN", "NINETEEN"
];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

function underHundred(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function underThousand(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundred) parts.push(`${ONES[hundred]} HUNDRED`);
  if (rest) parts.push(underHundred(rest));
  return parts.join(" ");
}

function integerToIndianWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "ZERO";

  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${integerToIndianWords(crore)} CRORE`);
  if (lakh) parts.push(`${underHundred(lakh)} LAKH`);
  if (thousand) parts.push(`${underHundred(thousand)} THOUSAND`);
  if (n) parts.push(underThousand(n));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function amountInWords(amount, currency = "INR") {
  const normalized = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  const whole = Math.floor(normalized);
  const paise = Math.round((normalized - whole) * 100);
  let text = `${String(currency).toUpperCase()} ${integerToIndianWords(whole)}`;
  if (paise) text += ` AND ${integerToIndianWords(paise)} PAISE`;
  return `${text} ONLY`;
}

module.exports = { amountInWords, integerToIndianWords };

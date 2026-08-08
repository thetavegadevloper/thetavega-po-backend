function getFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const start = month >= 4 ? year : year - 1;
  const end = start + 1;
  return `${start}-${String(end).slice(-2)}`;
}

module.exports = getFinancialYear;

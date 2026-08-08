const POSequence = require("../models/POSequence");
const getFinancialYear = require("../utils/financialYear");

async function reservePONumber(companyId, poDate = new Date()) {
  const financialYear = getFinancialYear(new Date(poDate));
  const prefix = String(process.env.PO_NUMBER_PREFIX || "PO");
  const start = Number(process.env.PO_SEQUENCE_START || 1);
  const padding = Number(process.env.PO_NUMBER_PADDING || 6);

  const filter = { companyId, financialYear, prefix };
  const sequence = await POSequence.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          companyId,
          financialYear,
          prefix,
          nextNumber: {
            $add: [{ $ifNull: ["$nextNumber", start - 1] }, 1]
          }
        }
      }
    ],
    { upsert: true, new: true }
  );

  return `${prefix}${String(sequence.nextNumber).padStart(padding, "0")}`;
}

module.exports = { reservePONumber };

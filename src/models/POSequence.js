const mongoose = require("mongoose");

const POSequenceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    financialYear: { type: String, required: true },
    prefix: { type: String, required: true },
    nextNumber: { type: Number, required: true, min: 1 }
  },
  { timestamps: true }
);

POSequenceSchema.index({ companyId: 1, financialYear: 1, prefix: 1 }, { unique: true });

module.exports = mongoose.model("POSequence", POSequenceSchema);

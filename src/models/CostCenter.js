const mongoose = require("mongoose");

const CostCenterSchema = new mongoose.Schema(
  {
    costCenterCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    costCenterName: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    type: { type: String, enum: ["Service", "Manufacturing", "Trading"], required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CostCenter", CostCenterSchema);

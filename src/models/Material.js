const mongoose = require("mongoose");

const MaterialSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    make: { type: String, trim: true, default: "" },
    model: { type: String, trim: true, default: "" },
    uom: { type: String, required: true, trim: true },
    specification: { type: String, trim: true, default: "" },
    itemType: { type: String, required: true, enum: ["Service", "Goods", "Goods + Service"] },
    hsnSacCode: { type: String, trim: true, default: "" },
        rate: {
      type: Number,
      min: 0,
      default: 0
    },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    tdsPercent: { type: Number, min: 0, max: 100, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Material", MaterialSchema);

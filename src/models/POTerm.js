const mongoose = require("mongoose");

const POTermSchema = new mongoose.Schema(
  {
    termCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    scope: { type: String, required: true, enum: ["Specific", "General"] },
    category: {
      type: String,
      enum: [
        "Application", "Packing", "Freight", "Delivery", "Payment", "Warranty", "Service",
        "Technical", "Documentation", "Certification", "Training", "Special", "General"
      ],
      default: "General"
    },
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    displayOrder: { type: Number, required: true, min: 1 },
    mandatory: { type: Boolean, default: true },
    canOverride: { type: Boolean, default: true },
    editablePerPO: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

POTermSchema.index({ scope: 1, displayOrder: 1 });

module.exports = mongoose.model("POTerm", POTermSchema);

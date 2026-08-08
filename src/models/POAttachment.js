const mongoose = require("mongoose");

const POAttachmentSchema = new mongoose.Schema(
  {
    poId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    fileType: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model("POAttachment", POAttachmentSchema);

const mongoose = require("mongoose");

const POAuditLogSchema = new mongoose.Schema(
  {
    poId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    poNumber: { type: String, required: true },
    revisionNo: { type: Number, required: true },
    action: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    remarks: { type: String, trim: true, default: "" },
    changedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

POAuditLogSchema.index({ poId: 1, changedAt: -1 });

module.exports = mongoose.model("POAuditLog", POAuditLogSchema);

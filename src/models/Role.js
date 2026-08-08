const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true, trim: true },
    permissions: [{ type: String, trim: true }],
    approvalLimit: { type: Number, min: 0, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", RoleSchema);

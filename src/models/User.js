const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    mobile: { type: String, trim: true, default: "" },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    userId: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model("User", UserSchema);

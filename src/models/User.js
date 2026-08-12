const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    department: {
      type: String,
      trim: true,
      default: ""
    },

    designation: {
      type: String,
      trim: true,
      default: ""
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    mobile: {
      type: String,
      trim: true,
      default: ""
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true
    },

    // =====================================================
    // PO APPROVAL LEVEL
    //
    // L3 = Supervisor / PO Creator / Initiator
    //      - Can create PO
    //      - Submit PO for approval
    //      - Cannot approve submitted PO
    //
    // L2 = Manager / Final Approval Authority
    //      - Can approve/reject L3 submitted PO
    //      - Own created PO does not require approval
    //
    // L1 = Director / Final Approval Authority
    //      - Can approve/reject L3 submitted PO
    //      - Own created PO does not require approval
    //
    // IMPORTANT:
    // L2 and L1 are NOT sequential approvals.
    // Either L2 OR L1 can provide final approval.
    // =====================================================
    approvalLevel: {
      type: String,
      enum: ["L1", "L2", "L3"],
      default: "L3",
      required: true,
      uppercase: true,
      trim: true
    },

    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    isActive: {
      type: Boolean,
      default: true
    }
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

module.exports = mongoose.model(
  "User",
  UserSchema
);
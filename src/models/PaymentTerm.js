const mongoose = require("mongoose");

const PaymentTermSchema = new mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },

    paymentName: {
      type: String,
      required: true,
      trim: true
    },

    paymentSummary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    description: {
      type: String,
      trim: true,
      default: ""
    },

    displayOrder: {
      type: Number,
      default: 1
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "PaymentTerm",
  PaymentTermSchema
);
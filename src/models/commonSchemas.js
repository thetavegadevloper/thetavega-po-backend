const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, required: true },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, required: true },
    district: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, required: true },
    stateCode: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, required: true },
    country: { type: String, trim: true, default: "India" }
  },
  { _id: false }
);

const BankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: "" },
    accountNo: { type: String, trim: true, default: "" },
    ifsc: { type: String, trim: true, uppercase: true, default: "" },
    branch: { type: String, trim: true, default: "" },
    bankAddress: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Sales", "Service", "Logistics", "Support", "Accounts", "Management", "Other"],
      default: "Other"
    },
    name: { type: String, trim: true, required: true },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" }
  },
  { _id: true }
);

module.exports = { AddressSchema, BankDetailsSchema, ContactSchema };

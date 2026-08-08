const mongoose = require("mongoose");
const { AddressSchema, BankDetailsSchema } = require("./commonSchemas");

const CompanySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true, maxlength: 150 },
    companyCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    gstin: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 15, maxlength: 15 },
    pan: { type: String, required: true, trim: true, uppercase: true },
    cin: { type: String, trim: true, uppercase: true, default: "" },
    stateCode: { type: String, required: true, trim: true },
    gstState: { type: String, required: true, trim: true },
    registeredAddress: { type: AddressSchema, required: true },
    contactNo: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    website: { type: String, trim: true, default: "" },
    logo: { type: String, trim: true, default: "" },
    bankDetails: { type: BankDetailsSchema, default: () => ({}) },
    authorizedSignatoryText: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", CompanySchema);

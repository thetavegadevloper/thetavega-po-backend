const mongoose = require("mongoose");
const { AddressSchema, ContactSchema } = require("./commonSchemas");

const VendorSchema = new mongoose.Schema(
  {
    vendorCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    vendorName: { type: String, required: true, trim: true, maxlength: 200 },
    purchaseType: { type: String, required: true, enum: ["Domestic", "Import"] },
    registeredAddress: { type: AddressSchema, required: true },
    gstNo: { type: String, trim: true, uppercase: true, default: "" },
    gstCertificate: { type: String, trim: true, default: "" },
    panNo: { type: String, trim: true, uppercase: true, default: "" },
    panCard: { type: String, trim: true, default: "" },
    bankName: { type: String, trim: true, default: "" },
    accountNo: { type: String, trim: true, default: "" },
    ifsc: { type: String, trim: true, uppercase: true, default: "" },
    bankAddress: { type: String, trim: true, default: "" },
    cancelledCheque: { type: String, trim: true, default: "" },
    contacts: { type: [ContactSchema], default: [] },
    supportingFiles: [{ type: String, trim: true }],
    currency: { type: String, required: true, uppercase: true, trim: true, default: "INR" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

VendorSchema.pre("validate", function validateDomestic(next) {
  if (this.purchaseType === "Domestic" && !this.gstNo) {
    return next(new Error("gstNo is required for Domestic vendor"));
  }
  return next();
});

module.exports = mongoose.model("Vendor", VendorSchema);

const mongoose = require("mongoose");
const { AddressSchema } = require("./commonSchemas");

const DeliveryAddressSchema = new mongoose.Schema(
  {
    deliveryCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    registeredAddress: { type: AddressSchema, required: true },
    gstNo: { type: String, trim: true, uppercase: true, default: "" },
    panNo: { type: String, trim: true, uppercase: true, default: "" },
    landmark: { type: String, trim: true, default: "" },
    storeContactNo: { type: String, trim: true, default: "" },
    storePersonName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeliveryAddress", DeliveryAddressSchema);

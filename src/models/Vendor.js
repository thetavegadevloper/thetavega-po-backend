const mongoose = require("mongoose");
const {
  AddressSchema,
  ContactSchema
} = require("./commonSchemas");

// =====================================================
// FILE METADATA SCHEMA
// =====================================================
const FileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      trim: true,
      default: ""
    },

    fileName: {
      type: String,
      trim: true,
      default: ""
    },

    path: {
      type: String,
      trim: true,
      default: ""
    },

    url: {
      type: String,
      trim: true,
      default: ""
    },

    mimetype: {
      type: String,
      trim: true,
      default: ""
    },

    size: {
      type: Number,
      default: 0
    },

    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

// =====================================================
// VENDOR SCHEMA
// =====================================================
const VendorSchema = new mongoose.Schema(
  {
    vendorCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },

    vendorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    purchaseType: {
      type: String,
      required: true,
      enum: [
        "Domestic",
        "Import"
      ]
    },

    registeredAddress: {
      type: AddressSchema,
      required: true
    },

    // =====================================================
    // GST DETAILS
    // =====================================================
    gstNo: {
      type: String,
      trim: true,
      uppercase: true,
      default: ""
    },

    gstCertificate: {
      type: FileSchema,
      default: null
    },

    // =====================================================
    // PAN DETAILS
    // =====================================================
    panNo: {
      type: String,
      trim: true,
      uppercase: true,
      default: ""
    },

    panCard: {
      type: FileSchema,
      default: null
    },

    // =====================================================
    // BANK DETAILS
    // =====================================================
    bankName: {
      type: String,
      trim: true,
      default: ""
    },

    accountNo: {
      type: String,
      trim: true,
      default: ""
    },

    ifsc: {
      type: String,
      trim: true,
      uppercase: true,
      default: ""
    },

    bankAddress: {
      type: String,
      trim: true,
      default: ""
    },

    cancelledCheque: {
      type: String,
      trim: true,
      default: ""
    },

    // =====================================================
    // CONTACT DETAILS
    // =====================================================
    contacts: {
      type: [
        ContactSchema
      ],
      default: []
    },

    // =====================================================
    // SUPPORTING FILES
    // =====================================================
    supportingFiles: {
      type: [
        FileSchema
      ],
      default: []
    },

    // =====================================================
    // OTHER DETAILS
    // =====================================================
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "INR"
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

// =====================================================
// DOMESTIC VENDOR VALIDATION
// =====================================================
VendorSchema.pre(
  "validate",
  function validateDomestic(next) {
    if (
      this.purchaseType === "Domestic" &&
      !this.gstNo
    ) {
      return next(
        new Error(
          "gstNo is required for Domestic vendor"
        )
      );
    }

    return next();
  }
);

// =====================================================
// EXPORT
// =====================================================
module.exports = mongoose.model(
  "Vendor",
  VendorSchema
);
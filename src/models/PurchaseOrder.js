const mongoose = require("mongoose");

const {
  PO_STATUS,
  PURCHASE_TYPES,
  PO_TYPES,
  CHARGE_MODES
} = require("../constants/po");

// =====================================================
// ADDRESS SNAPSHOT
// =====================================================
const AddressSnapshotSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    city: String,
    district: String,
    state: String,
    stateCode: String,
    pincode: String,
    country: String
  },
  {
    _id: false
  }
);

// =====================================================
// COMPANY SNAPSHOT
// =====================================================
const CompanySnapshotSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    companyCode: String,
    companyName: String,
    gstin: String,
    pan: String,
    cin: String,
    stateCode: String,
    gstState: String,

    registeredAddress:
      AddressSnapshotSchema,

    contactNo: String,
    email: String,
    website: String,
    logo: String,
    authorizedSignatoryText: String
  },
  {
    _id: false
  }
);

// =====================================================
// VENDOR CONTACT SNAPSHOT
// =====================================================
const VendorContactSnapshotSchema =
  new mongoose.Schema(
    {
      type: String,
      name: String,
      phone: String,
      email: String
    },
    {
      _id: false
    }
  );

// =====================================================
// VENDOR SNAPSHOT
// =====================================================
const VendorSnapshotSchema =
  new mongoose.Schema(
    {
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },

      vendorCode: String,
      vendorName: String,
      purchaseType: String,

      registeredAddress:
        AddressSnapshotSchema,

      gstNo: String,
      panNo: String,

      contacts: [
        VendorContactSnapshotSchema
      ],

      currency: String
    },
    {
      _id: false
    }
  );

// =====================================================
// DELIVERY SNAPSHOT
// =====================================================
const DeliverySnapshotSchema =
  new mongoose.Schema(
    {
      deliveryAddressId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },

      deliveryCode: String,
      name: String,

      registeredAddress:
        AddressSnapshotSchema,

      gstNo: String,
      panNo: String,
      landmark: String,
      storeContactNo: String,
      storePersonName: String,
      email: String
    },
    {
      _id: false
    }
  );

// =====================================================
// COST CENTER SNAPSHOT
// =====================================================
const CostCenterSnapshotSchema =
  new mongoose.Schema(
    {
      costCenterId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },

      costCenterCode: String,
      costCenterName: String,
      type: String
    },
    {
      _id: false
    }
  );

// =====================================================
// PROJECT SNAPSHOT
// =====================================================
const ProjectSnapshotSchema =
  new mongoose.Schema(
    {
      projectId:
        mongoose.Schema.Types.ObjectId,

      projectCode: String,
      customerName: String,
      projectName: String,
      location: String,
      application: String,
      projectDocumentNo: String
    },
    {
      _id: false
    }
  );

// =====================================================
// PO ITEM
// =====================================================
const POItemSchema =
  new mongoose.Schema(
    {
      srNo: {
        type: Number,
        required: true,
        min: 1
      },

      materialId: {
        type:
          mongoose.Schema.Types.ObjectId,
        default: null
      },

      materialCode: {
        type: String,
        required: true,
        trim: true
      },

      description: {
        type: String,
        required: true,
        trim: true
      },

      hsnSac: {
        type: String,
        trim: true,
        default: ""
      },

      uom: {
        type: String,
        required: true,
        trim: true
      },

      qty: {
        type: Number,
        required: true,
        min: 0.000001
      },

      rate: {
        type: Number,
        required: true,
        min: 0
      },

      basicAmount: {
        type: Number,
        required: true,
        min: 0
      },

      gstPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },

      gstAmount: {
        type: Number,
        min: 0,
        default: 0
      },

      tdsPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },

      deliveryDate: {
        type: Date,
        default: null
      },

      remarks: {
        type: String,
        trim: true,
        default: ""
      }
    },
    {
      _id: true
    }
  );

// =====================================================
// PAYMENT TERM SNAPSHOT
// =====================================================
const PaymentTermSnapshotSchema =
  new mongoose.Schema(
    {
      paymentTermId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "PaymentTerm",

        required: true
      },

      paymentCode: {
        type: String,
        required: true,
        trim: true
      },

      paymentName: {
        type: String,
        required: true,
        trim: true
      },

      paymentSummary: {
        type: String,
        required: true,
        trim: true
      }
    },
    {
      _id: false
    }
  );

// =====================================================
// PO TERM SNAPSHOT
// =====================================================
const POTermSnapshotSchema =
  new mongoose.Schema(
    {
      termId: {
        type:
          mongoose.Schema.Types.ObjectId,
        default: null
      },

      termCode: {
        type: String,
        default: ""
      },

      category: {
        type: String,
        default: "General"
      },

      title: {
        type: String,
        required: true
      },

      text: {
        type: String,
        required: true
      },

      displayOrder: {
        type: Number,
        required: true
      },

      mandatory: {
        type: Boolean,
        default: true
      },

      canOverride: {
        type: Boolean,
        default: true
      }
    },
    {
      _id: false
    }
  );

// =====================================================
// APPROVAL INFORMATION
// =====================================================
const ApprovalSchema =
  new mongoose.Schema(
    {
      required: {
        type: Boolean,
        default: true
      },

      // ===============================================
      // SUBMISSION
      // ===============================================
      submittedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },

      submittedAt: {
        type: Date,
        default: null
      },

      submitComment: {
        type: String,
        default: ""
      },

      // NEW
      submittedLevel: {
        type: String,
        enum: [
          "L1",
          "L2",
          "L3",
          null
        ],
        default: null
      },

      // ===============================================
      // APPROVAL / FINALIZATION
      // ===============================================
      approvedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },

      approvedAt: {
        type: Date,
        default: null
      },

      approvalComment: {
        type: String,
        default: ""
      },

      // NEW
      approvedLevel: {
        type: String,
        enum: [
          "L1",
          "L2",
          "L3",
          null
        ],
        default: null
      },

      // ===============================================
      // REJECTION
      // ===============================================
      rejectedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },

      rejectedAt: {
        type: Date,
        default: null
      },

      rejectionReason: {
        type: String,
        default: ""
      },

      // NEW
      rejectedLevel: {
        type: String,
        enum: [
          "L1",
          "L2",
          "L3",
          null
        ],
        default: null
      }
    },
    {
      _id: false
    }
  );

// =====================================================
// PURCHASE ORDER
// =====================================================
const PurchaseOrderSchema =
  new mongoose.Schema(
    {
      poNumber: {
        type: String,
        required: true,
        trim: true
      },

      revisionNo: {
        type: Number,
        required: true,
        min: 0,
        default: 0
      },

      poDate: {
        type: Date,
        required: true
      },

      documentHeading: {
        type: String,
        required: true,
        trim: true
      },

      purchaseType: {
        type: String,
        required: true,
        enum: PURCHASE_TYPES
      },

      poType: {
        type: String,
        required: true,
        enum: PO_TYPES
      },

      currency: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
      },

      company: {
        type:
          CompanySnapshotSchema,
        required: true
      },

      vendor: {
        type:
          VendorSnapshotSchema,
        required: true
      },

      delivery: {
        type:
          DeliverySnapshotSchema,
        required: true
      },

      costCenter: {
        type:
          CostCenterSnapshotSchema,
        required: true
      },

      project: {
        type:
          ProjectSnapshotSchema,
        default: null
      },

      // =================================================
      // PAYMENT TERM SNAPSHOT
      // =================================================
      paymentTerm: {
        type:
          PaymentTermSnapshotSchema,
        default: null
      },

      header: {
        quoteRefDocumentNo: {
          type: String,
          default: ""
        },

        documentType: {
          type: String,
          default: ""
        },

        confirmedBy: {
          type: String,
          default: ""
        },

        projectDocumentNo: {
          type: String,
          default: ""
        },

        referenceNo: {
          type: String,
          default: ""
        },

        paymentSummary: {
          type: String,
          required: true
        },

        buyerName: {
          type: String,
          required: true
        },

        buyerContact: {
          type: String,
          default: ""
        },

        taxesDutiesText: {
          type: String,
          required: true,
          default:
            "EXTRA AT ACTUAL"
        },

        supplierTaxNote: {
          type: String,
          default: ""
        },

        specialNotes: {
          type: String,
          default: ""
        },

        authorizedSignatory: {
          type: String,
          default: ""
        }
      },

      items: {
        type: [
          POItemSchema
        ],

        validate: [
          (items) =>
            Array.isArray(items) &&
            items.length > 0,

          "At least one PO item is required"
        ]
      },

      charges: {
        packingMode: {
          type: String,
          enum: CHARGE_MODES,
          required: true,
          default: "At Actual"
        },

        packingValue: {
          type: Number,
          min: 0,
          default: 0
        },

        packingAmount: {
          type: Number,
          min: 0,
          default: 0
        },

        freightMode: {
          type: String,
          enum: CHARGE_MODES,
          required: true,
          default: "At Actual"
        },

        freightValue: {
          type: Number,
          min: 0,
          default: 0
        },

        freightAmount: {
          type: Number,
          min: 0,
          default: 0
        }
      },

      totals: {
        subTotal: {
          type: Number,
          required: true,
          min: 0
        },

        taxTotal: {
          type: Number,
          required: true,
          min: 0,
          default: 0
        },

        roundingOff: {
          type: Number,
          required: true,
          default: 0
        },

        grandTotal: {
          type: Number,
          required: true,
          min: 0
        },

        amountInWords: {
          type: String,
          required: true
        }
      },

      specificTerms: {
        type: [
          POTermSnapshotSchema
        ],
        default: []
      },

      generalTerms: {
        type: [
          POTermSnapshotSchema
        ],
        default: []
      },

      // =================================================
      // APPROVAL DETAILS
      // =================================================
      approval: {
        type:
          ApprovalSchema,
        default: () => ({})
      },

      // =================================================
      // NEW:
      // SNAPSHOT CREATOR APPROVAL LEVEL
      //
      // L3 = Requires final approval
      // L2 = Final authority
      // L1 = Final authority
      // =================================================
      creatorApprovalLevel: {
        type: String,

        enum: [
          "L1",
          "L2",
          "L3"
        ],

        default: "L3",

        index: true
      },

      status: {
        type: String,
        enum:
          Object.values(
            PO_STATUS
          ),
        default:
          PO_STATUS.DRAFT,
        index: true
      },

      pdf: {
        version: {
          type: Number,
          default: 0
        },

        storageKey: {
          type: String,
          default: ""
        },

        generatedAt: {
          type: Date,
          default: null
        },

        generatedBy: {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null
        },

        hash: {
          type: String,
          default: ""
        }
      },

      parentRevisionId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref:
          "PurchaseOrder",
        default: null
      },

      revisionReason: {
        type: String,
        default: ""
      },

      cancellationReason: {
        type: String,
        default: ""
      },

      createdBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      updatedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    },
    {
      timestamps: true
    }
  );

// =====================================================
// INDEXES
// =====================================================
PurchaseOrderSchema.index(
  {
    poNumber: 1,
    revisionNo: 1
  },
  {
    unique: true
  }
);

PurchaseOrderSchema.index({
  poDate: -1,
  status: 1
});

PurchaseOrderSchema.index({
  "vendor.vendorId": 1,
  poDate: -1
});

PurchaseOrderSchema.index({
  "project.projectId": 1,
  poDate: -1
});

PurchaseOrderSchema.index({
  "costCenter.costCenterId": 1,
  poDate: -1
});

module.exports =
  mongoose.model(
    "PurchaseOrder",
    PurchaseOrderSchema
  );
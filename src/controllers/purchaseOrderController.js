const fs = require("fs");

const PurchaseOrder = require("../models/PurchaseOrder");
const User = require("../models/User");
const PaymentTerm = require("../models/PaymentTerm");
const POAuditLog = require("../models/POAuditLog");

const ApiError = require("../utils/ApiError");

const { PO_STATUS } = require("../constants/po");

const {
  reservePONumber
} = require("../services/poNumberService");

const {
  buildMasterSnapshots,
  buildItemSnapshots,
  buildTermSnapshots
} = require("../services/snapshotService");

const {
  calculatePO
} = require("../services/poCalculationService");

const {
  writeAudit
} = require("../services/auditService");

const {
  renderPdfBuffer,
  storeOfficialPdf,
  getStoredPdfPath
} = require("../services/poPdfService");


// =====================================================
// APPROVAL LEVELS
// =====================================================

const APPROVAL_LEVEL = {
  L1: "L1",
  L2: "L2",
  L3: "L3"
};


// =====================================================
// APPROVAL CONFIG
// =====================================================

function approvalRequired() {
  return (
    String(
      process.env.PO_APPROVAL_REQUIRED || "true"
    ).toLowerCase() !== "false"
  );
}


// =====================================================
// PERMISSION HELPER
// =====================================================

function hasPermission(req, key) {
  return (
    req.user?.permissions?.includes("*") ||
    req.user?.permissions?.includes(key)
  );
}


// =====================================================
// NORMALIZE APPROVAL LEVEL
// =====================================================

function normalizeApprovalLevel(value) {
  const level = String(value || "")
    .trim()
    .toUpperCase();

  if (
    [
      APPROVAL_LEVEL.L1,
      APPROVAL_LEVEL.L2,
      APPROVAL_LEVEL.L3
    ].includes(level)
  ) {
    return level;
  }

  return null;
}


// =====================================================
// GET CURRENT LOGGED-IN USER APPROVAL LEVEL
// =====================================================

async function getRequestUserApprovalLevel(req) {
  const requestLevel =
    normalizeApprovalLevel(
      req.user?.approvalLevel
    );

  if (requestLevel) {
    return requestLevel;
  }

  const userId =
    req.user?.id ||
    req.user?._id;

  if (!userId) {
    throw new ApiError(
      401,
      "Authenticated user not found"
    );
  }

  const user = await User.findById(userId)
    .select("approvalLevel isActive")
    .lean();

  if (!user) {
    throw new ApiError(
      401,
      "Authenticated user not found"
    );
  }

  if (user.isActive === false) {
    throw new ApiError(
      403,
      "User is inactive"
    );
  }

  return (
    normalizeApprovalLevel(
      user.approvalLevel
    ) ||
    APPROVAL_LEVEL.L3
  );
}


// =====================================================
// GET ORIGINAL PO CREATOR LEVEL
//
// This is only historical/fallback information.
// It does NOT decide Submit / Finalize anymore.
// =====================================================

async function getPOCreatorApprovalLevel(po) {
  const storedLevel =
    normalizeApprovalLevel(
      po.creatorApprovalLevel
    );

  if (storedLevel) {
    return storedLevel;
  }

  if (!po.createdBy) {
    return APPROVAL_LEVEL.L3;
  }

  const creator = await User.findById(
    po.createdBy
  )
    .select("approvalLevel")
    .lean();

  return (
    normalizeApprovalLevel(
      creator?.approvalLevel
    ) ||
    APPROVAL_LEVEL.L3
  );
}


// =====================================================
// GET ACTUAL SUBMISSION LEVEL
//
// IMPORTANT:
//
// Approval is based on WHO SUBMITTED the PO.
//
// Example:
//
// L2 created Draft
// L3 later submitted it
//
// Then:
//
// submittedLevel = L3
//
// Therefore L2/L1 can approve it.
// =====================================================

async function getPOSubmissionLevel(po) {
  const storedLevel =
    normalizeApprovalLevel(
      po.approval?.submittedLevel
    );

  if (storedLevel) {
    return storedLevel;
  }

  const submittedById =
    po.approval?.submittedBy?._id ||
    po.approval?.submittedBy;

  if (submittedById) {
    const submittedUser =
      await User.findById(
        submittedById
      )
        .select("approvalLevel")
        .lean();

    const level =
      normalizeApprovalLevel(
        submittedUser?.approvalLevel
      );

    if (level) {
      return level;
    }
  }

  // Legacy fallback
  return getPOCreatorApprovalLevel(po);
}


// =====================================================
// FINAL APPROVAL AUTHORITY
//
// L2 OR L1
//
// NOT:
//
// L2 -> L1
// =====================================================

function isFinalApprovalAuthority(level) {
  return (
    level === APPROVAL_LEVEL.L2 ||
    level === APPROVAL_LEVEL.L1
  );
}


// =====================================================
// NORMALIZE HEADER
// =====================================================

function normalizeHeader(
  payload,
  snapshots,
  reqUser,
  existing = {}
) {
  const h = {
    ...(existing || {}),
    ...(payload.header || {})
  };

  return {
    quoteRefDocumentNo:
      h.quoteRefDocumentNo || "",

    documentType:
      h.documentType || "",

    confirmedBy:
      h.confirmedBy || "",

    projectDocumentNo:
      h.projectDocumentNo ||
      snapshots.project?.projectDocumentNo ||
      "",

    referenceNo:
      h.referenceNo || "",

    paymentSummary:
      h.paymentSummary || "",

    buyerName:
      h.buyerName ||
      reqUser.name,

    buyerContact:
      h.buyerContact ||
      reqUser.mobile ||
      "",

    taxesDutiesText:
      h.taxesDutiesText ||
      "EXTRA AT ACTUAL",

    supplierTaxNote:
      h.supplierTaxNote ||
      "Supplier to ensure the Appropriate HSN & applicable Tax Rates as per applicable law.",

    specialNotes:
      h.specialNotes || "",

    authorizedSignatory:
      h.authorizedSignatory ||
      snapshots.company.authorizedSignatoryText ||
      "AUTHORISED SIGNATORY"
  };
}


// =====================================================
// VALIDATE CREATE PAYLOAD
// =====================================================

function validateCreatePayload(payload) {
  const required = [
    "companyId",
    "vendorId",
    "costCenterId",
    "deliveryAddressId",
    "poType",
    "paymentTermId"
  ];

  for (const field of required) {
    if (!payload[field]) {
      throw new ApiError(
        400,
        `${field} is required`
      );
    }
  }

  if (!payload.poDate) {
    throw new ApiError(
      400,
      "poDate is required"
    );
  }
}


// =====================================================
// LIST PURCHASE ORDERS
// =====================================================

exports.list = async (req, res) => {
  const page = Math.max(
    Number(req.query.page || 1),
    1
  );

  const limit = Math.min(
    Math.max(
      Number(req.query.limit || 30),
      1
    ),
    200
  );

  const filter = {};

  // ===================================================
  // DATE FILTER
  // ===================================================

  if (
    req.query.dateFrom ||
    req.query.dateTo
  ) {
    filter.poDate = {};

    if (req.query.dateFrom) {
      filter.poDate.$gte =
        new Date(
          req.query.dateFrom
        );
    }

    if (req.query.dateTo) {
      const end =
        new Date(
          req.query.dateTo
        );

      end.setHours(
        23,
        59,
        59,
        999
      );

      filter.poDate.$lte =
        end;
    }
  }

  // ===================================================
  // MASTER FILTERS
  // ===================================================

  if (req.query.vendorId) {
    filter["vendor.vendorId"] =
      req.query.vendorId;
  }

  if (req.query.projectId) {
    filter["project.projectId"] =
      req.query.projectId;
  }

  if (req.query.costCenterId) {
    filter["costCenter.costCenterId"] =
      req.query.costCenterId;
  }

  // ===================================================
  // STATUS
  // ===================================================

  if (req.query.status) {
    filter.status =
      req.query.status;
  }

  // ===================================================
  // PO TYPE
  // ===================================================

  if (req.query.poType) {
    filter.poType =
      req.query.poType;
  }

  // ===================================================
  // PURCHASE TYPE
  // ===================================================

  if (req.query.purchaseType) {
    filter.purchaseType =
      req.query.purchaseType;
  }

  // ===================================================
  // SEARCH
  // ===================================================

  if (req.query.search) {
    const regex =
      new RegExp(
        req.query.search,
        "i"
      );

    filter.$or = [
      {
        poNumber:
          regex
      },
      {
        "vendor.vendorName":
          regex
      },
      {
        "vendor.vendorCode":
          regex
      },
      {
        "project.projectCode":
          regex
      },
      {
        "project.projectName":
          regex
      }
    ];
  }

  // ===================================================
  // FETCH
  // ===================================================

  const [data, total] =
    await Promise.all([
      PurchaseOrder.find(filter)
        .select(
          [
            "poNumber",
            "revisionNo",
            "poDate",
            "documentHeading",
            "purchaseType",
            "poType",
            "currency",
            "vendor",
            "project",
            "costCenter",
            "totals",
            "status",
            "pdf",
            "creatorApprovalLevel",
            "approval.submittedBy",
            "approval.submittedAt",
            "approval.submittedLevel",
            "createdAt",
            "updatedAt"
          ].join(" ")
        )
        .populate(
          "approval.submittedBy",
          "name employeeCode email approvalLevel"
        )
        .sort({
          poDate: -1,
          createdAt: -1
        })
        .skip(
          (page - 1) *
          limit
        )
        .limit(limit)
        .lean(),

      PurchaseOrder.countDocuments(
        filter
      )
    ]);

  return res.json({
    success: true,

    data,

    pagination: {
      page,
      limit,
      total,
      pages:
        Math.ceil(
          total /
          limit
        )
    }
  });
};


// =====================================================
// GET PURCHASE ORDER
// =====================================================

exports.getById = async (req, res) => {
  const data =
    await PurchaseOrder.findById(
      req.params.id
    )
      .populate(
        "approval.submittedBy approval.approvedBy approval.rejectedBy",
        "name employeeCode email approvalLevel"
      )
      .lean();

  if (!data) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  return res.json({
    success: true,
    data
  });
};


// =====================================================
// CREATE PURCHASE ORDER
// =====================================================

exports.create = async (req, res) => {
  const payload =
    req.body || {};

  // ===================================================
  // 1. VALIDATION
  // ===================================================

  validateCreatePayload(
    payload
  );

  // ===================================================
  // 2. CREATOR APPROVAL LEVEL
  //
  // Stored only as historical information.
  // ===================================================

  const creatorApprovalLevel =
    await getRequestUserApprovalLevel(
      req
    );

  // ===================================================
  // 3. PAYMENT TERM
  // ===================================================

  const paymentTerm =
    await PaymentTerm.findOne({
      _id:
        payload.paymentTermId,

      isActive:
        true
    });

  if (!paymentTerm) {
    throw new ApiError(
      400,
      "Valid Payment Term is required"
    );
  }

  // ===================================================
  // 4. MASTER SNAPSHOTS
  // ===================================================

  const snapshots =
    await buildMasterSnapshots(
      payload
    );

  const purchaseType =
    payload.purchaseType ||
    snapshots.vendor.purchaseType;

  const currency =
    payload.currency ||
    snapshots.vendor.currency ||
    "INR";

  const documentHeading =
    payload.documentHeading ||
    `${String(
      purchaseType
    ).toUpperCase()} PURCHASE ORDER`;

  // ===================================================
  // 5. ITEMS
  // ===================================================

  const allowManual =
    hasPermission(
      req,
      "po.manual_item"
    );

  const itemSnapshots =
    await buildItemSnapshots(
      payload.items || [],
      allowManual
    );

  // ===================================================
  // 6. TERMS
  // ===================================================

  const terms =
    await buildTermSnapshots(
      payload,
      snapshots.source.project
    );

  // ===================================================
  // 7. CALCULATIONS
  // ===================================================

  const calculated =
    calculatePO({
      items:
        itemSnapshots,

      charges:
        payload.charges,

      roundingOff:
        payload.roundingOff ??
        payload.totals?.roundingOff ??
        0,

      currency
    });

  // ===================================================
  // 8. PO NUMBER
  // ===================================================

  const poNumber =
    await reservePONumber(
      snapshots.company.companyId,
      payload.poDate
    );

  // ===================================================
  // 9. HEADER
  // ===================================================

  const header =
    normalizeHeader(
      {
        ...payload,

        header: {
          ...(payload.header || {}),

          paymentSummary:
            paymentTerm.paymentSummary
        }
      },

      snapshots,

      req.user,

      {}
    );

  // ===================================================
  // 10. PAYMENT TERM SNAPSHOT
  // ===================================================

  const paymentTermSnapshot = {
    paymentTermId:
      paymentTerm._id,

    paymentCode:
      paymentTerm.paymentCode,

    paymentName:
      paymentTerm.paymentName,

    paymentSummary:
      paymentTerm.paymentSummary
  };

  // ===================================================
  // 11. CREATE PO
  // ===================================================

  const po =
    await PurchaseOrder.create({
      poNumber,

      revisionNo:
        0,

      poDate:
        payload.poDate,

      documentHeading,

      purchaseType,

      poType:
        payload.poType,

      currency,

      company:
        snapshots.company,

      vendor:
        snapshots.vendor,

      delivery:
        snapshots.delivery,

      costCenter:
        snapshots.costCenter,

      project:
        snapshots.project,

      paymentTerm:
        paymentTermSnapshot,

      header,

      items:
        calculated.items,

      charges:
        calculated.charges,

      totals:
        calculated.totals,

      specificTerms:
        terms.specificTerms,

      generalTerms:
        terms.generalTerms,

      // =================================================
      // This value may change when another user performs
      // Submit / Finalize.
      // =================================================
      approval: {
        required:
          creatorApprovalLevel ===
            APPROVAL_LEVEL.L3
            ? approvalRequired()
            : false
      },

      // =================================================
      // Historical creator level
      // =================================================
      creatorApprovalLevel,

      status:
        PO_STATUS.DRAFT,

      createdBy:
        req.user.id,

      updatedBy:
        req.user.id
    });

  // ===================================================
  // 12. AUDIT
  // ===================================================

  await writeAudit({
    po,

    action:
      "CREATED",

    userId:
      req.user.id,

    remarks:
      `Created by ${creatorApprovalLevel} user`,

    after:
      po.toObject()
  });

  // ===================================================
  // 13. RESPONSE
  // ===================================================

  return res
    .status(201)
    .json({
      success: true,
      data: po
    });
};


// =====================================================
// UPDATE PURCHASE ORDER
//
// IMPORTANT:
//
// NO CREATOR RESTRICTION.
//
// Any user with route permission can edit the PO.
//
// Existing status behavior is preserved.
// =====================================================

exports.update = async (req, res) => {
  // ===================================================
  // 1. FIND PO
  // ===================================================

  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  // ===================================================
  // 2. EDITABLE STATUSES
  //
  // Existing behavior preserved.
  // ===================================================

  const editableStatuses = [
    PO_STATUS.DRAFT,
    PO_STATUS.REJECTED,
    PO_STATUS.PENDING_APPROVAL,
    PO_STATUS.APPROVED,
    PO_STATUS.ISSUED
  ];

  if (
    !editableStatuses.includes(
      po.status
    )
  ) {
    throw new ApiError(
      409,
      `PO cannot be edited in ${po.status} status`
    );
  }

  // ===================================================
  // 3. CURRENT STATUS
  // ===================================================

  const currentStatus =
    po.status;

  // ===================================================
  // 4. PAYLOAD
  // ===================================================

  const payload =
    req.body || {};

  // ===================================================
  // 5. BEFORE AUDIT
  // ===================================================

  const before =
    po.toObject();

  // ===================================================
  // 6. EXISTING ISSUED PDF
  // ===================================================

  const existingPdfPath =
    currentStatus ===
      PO_STATUS.ISSUED
      ? getStoredPdfPath(
          po.pdf?.storageKey
        )
      : null;

  const previousPdfVersion =
    Number(
      po.pdf?.version || 0
    );

  // ===================================================
  // 7. PAYMENT TERM
  // ===================================================

  const paymentTermId =
    payload.paymentTermId ||
    po.paymentTerm?.paymentTermId;

  if (!paymentTermId) {
    throw new ApiError(
      400,
      "Payment Term is required"
    );
  }

  const paymentTerm =
    await PaymentTerm.findOne({
      _id:
        paymentTermId,

      isActive:
        true
    });

  if (!paymentTerm) {
    throw new ApiError(
      400,
      "Valid Payment Term is required"
    );
  }

  // ===================================================
  // 8. SOURCE PAYLOAD
  // ===================================================

  const sourcePayload = {
    ...payload,

    companyId:
      payload.companyId ||
      po.company?.companyId,

    vendorId:
      payload.vendorId ||
      po.vendor?.vendorId,

    deliveryAddressId:
      payload.deliveryAddressId ||
      po.delivery?.deliveryAddressId,

    costCenterId:
      payload.costCenterId ||
      po.costCenter?.costCenterId,

    projectId:
      payload.projectId !== undefined
        ? payload.projectId
        : po.project?.projectId,

    poType:
      payload.poType ||
      po.poType
  };

  // ===================================================
  // 9. MASTER SNAPSHOTS
  // ===================================================

  const snapshots =
    await buildMasterSnapshots(
      sourcePayload
    );

  // ===================================================
  // 10. PURCHASE TYPE
  // ===================================================

  const purchaseType =
    payload.purchaseType ||
    snapshots.vendor?.purchaseType ||
    po.purchaseType;

  // ===================================================
  // 11. CURRENCY
  // ===================================================

  const currency =
    payload.currency ||
    snapshots.vendor?.currency ||
    po.currency ||
    "INR";

  // ===================================================
  // 12. MANUAL ITEM
  // ===================================================

  const allowManual =
    hasPermission(
      req,
      "po.manual_item"
    );

  // ===================================================
  // 13. ITEMS
  // ===================================================

  const rawItems =
    payload.items ||
    po.items.map(
      (item) =>
        item.toObject()
    );

  const itemSnapshots =
    await buildItemSnapshots(
      rawItems,
      allowManual
    );

  // ===================================================
  // 14. TERMS
  // ===================================================

  const termsPayload = {
    ...payload,

    specificTerms:
      payload.specificTerms ||
      po.specificTerms.map(
        (term) =>
          term.toObject()
      ),

    generalTerms:
      payload.generalTerms ||
      po.generalTerms.map(
        (term) =>
          term.toObject()
      )
  };

  const terms =
    await buildTermSnapshots(
      termsPayload,
      snapshots.source.project
    );

  // ===================================================
  // 15. CALCULATE
  // ===================================================

  const calculated =
    calculatePO({
      items:
        itemSnapshots,

      charges:
        payload.charges ||
        po.toObject().charges,

      roundingOff:
        payload.roundingOff ??
        payload.totals?.roundingOff ??
        po.totals?.roundingOff ??
        0,

      currency
    });

  // ===================================================
  // 16. BASIC DETAILS
  // ===================================================

  po.poDate =
    payload.poDate ||
    po.poDate;

  po.documentHeading =
    payload.documentHeading ||
    `${String(
      purchaseType
    ).toUpperCase()} PURCHASE ORDER`;

  po.purchaseType =
    purchaseType;

  po.poType =
    sourcePayload.poType;

  po.currency =
    currency;

  // ===================================================
  // 17. MASTER SNAPSHOTS
  // ===================================================

  po.company =
    snapshots.company;

  po.vendor =
    snapshots.vendor;

  po.delivery =
    snapshots.delivery;

  po.costCenter =
    snapshots.costCenter;

  po.project =
    snapshots.project;

  // ===================================================
  // 18. PAYMENT TERM SNAPSHOT
  // ===================================================

  po.paymentTerm = {
    paymentTermId:
      paymentTerm._id,

    paymentCode:
      paymentTerm.paymentCode,

    paymentName:
      paymentTerm.paymentName,

    paymentSummary:
      paymentTerm.paymentSummary
  };

  // ===================================================
  // 19. HEADER
  // ===================================================

  po.header =
    normalizeHeader(
      {
        ...payload,

        header: {
          ...(payload.header || {}),

          paymentSummary:
            paymentTerm.paymentSummary
        }
      },

      snapshots,

      req.user,

      po.toObject().header
    );

  // ===================================================
  // 20. ITEMS / CHARGES / TOTALS
  // ===================================================

  po.items =
    calculated.items;

  po.charges =
    calculated.charges;

  po.totals =
    calculated.totals;

  // ===================================================
  // 21. TERMS
  // ===================================================

  po.specificTerms =
    terms.specificTerms;

  po.generalTerms =
    terms.generalTerms;

  // ===================================================
  // 22. PRESERVE STATUS
  // ===================================================

  po.status =
    currentStatus;

  // ===================================================
  // 23. ISSUED PDF INVALIDATION
  // ===================================================

  if (
    currentStatus ===
    PO_STATUS.ISSUED
  ) {
    po.pdf = {
      version:
        previousPdfVersion,

      storageKey:
        "",

      generatedAt:
        null,

      generatedBy:
        null,

      hash:
        ""
    };
  }

  // ===================================================
  // 24. UPDATED BY
  // ===================================================

  po.updatedBy =
    req.user.id;

  // ===================================================
  // 25. SAVE
  // ===================================================

  await po.save();

  // ===================================================
  // 26. DELETE OLD PDF
  // ===================================================

  if (
    currentStatus ===
      PO_STATUS.ISSUED &&
    existingPdfPath
  ) {
    try {
      if (
        fs.existsSync(
          existingPdfPath
        )
      ) {
        fs.unlinkSync(
          existingPdfPath
        );

        console.log(
          `[PO UPDATE] Old PDF removed: ${existingPdfPath}`
        );
      }
    } catch (error) {
      console.error(
        "[PO UPDATE] Unable to remove old PDF:",
        error
      );
    }
  }

  // ===================================================
  // 27. AUDIT
  // ===================================================

  await writeAudit({
    po,

    action:
      "UPDATED",

    userId:
      req.user.id,

    remarks:
      currentStatus ===
        PO_STATUS.ISSUED
        ? "Issued PO updated. Existing official PDF invalidated and will be regenerated."
        : `PO updated while in ${currentStatus} status`,

    before,

    after:
      po.toObject()
  });

  // ===================================================
  // 28. RESPONSE
  // ===================================================

  return res.json({
    success: true,

    message:
      currentStatus ===
        PO_STATUS.ISSUED
        ? "Purchase Order updated successfully. Official PDF will be regenerated."
        : "Purchase Order updated successfully.",

    data:
      po
  });
};


// =====================================================
// SUBMIT / FINALIZE
//
// FINAL RULE:
//
// ANY L3 USER
// Draft/Rejected -> Pending Approval
//
// ANY L2 USER
// Draft/Rejected -> Approved
//
// ANY L1 USER
// Draft/Rejected -> Approved
//
// NO CREATOR RESTRICTION.
// =====================================================

exports.submit = async (req, res) => {
  // ===================================================
  // 1. FIND PO
  // ===================================================

  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  // ===================================================
  // 2. STATUS CHECK
  // ===================================================

  if (
    ![
      PO_STATUS.DRAFT,
      PO_STATUS.REJECTED
    ].includes(
      po.status
    )
  ) {
    throw new ApiError(
      409,
      `Only Draft/Rejected PO can be submitted/finalized; current status is ${po.status}`
    );
  }

  // ===================================================
  // 3. CURRENT ACTING USER LEVEL
  //
  // IMPORTANT:
  //
  // Creator is irrelevant here.
  // ===================================================

  const actingLevel =
    await getRequestUserApprovalLevel(
      req
    );

  const comment =
    String(
      req.body?.comment || ""
    ).trim();

  // ===================================================
  // L3
  //
  // ANY L3 USER CAN SUBMIT ANY DRAFT/REJECTED PO
  //
  // Draft -> Pending Approval
  // Rejected -> Pending Approval
  // ===================================================

  if (
    actingLevel ===
    APPROVAL_LEVEL.L3
  ) {
    if (!approvalRequired()) {
      throw new ApiError(
        409,
        "Approval workflow is disabled; issue the Draft PO directly"
      );
    }

    // =================================================
    // A PO may have originally been created by L1/L2.
    //
    // In that situation approval.required could be false.
    //
    // But now L3 is submitting it, so approval IS required.
    // =================================================

    po.approval.required =
      true;

    po.status =
      PO_STATUS.PENDING_APPROVAL;

    po.approval.submittedBy =
      req.user.id;

    po.approval.submittedAt =
      new Date();

    po.approval.submitComment =
      comment;

    po.approval.submittedLevel =
      APPROVAL_LEVEL.L3;

    // =================================================
    // CLEAR PREVIOUS APPROVAL
    // =================================================

    po.approval.approvedBy =
      null;

    po.approval.approvedAt =
      null;

    po.approval.approvalComment =
      "";

    po.approval.approvedLevel =
      null;

    // =================================================
    // CLEAR PREVIOUS REJECTION
    // =================================================

    po.approval.rejectedBy =
      null;

    po.approval.rejectedAt =
      null;

    po.approval.rejectionReason =
      "";

    po.approval.rejectedLevel =
      null;

    po.updatedBy =
      req.user.id;

    await po.save();

    await writeAudit({
      po,

      action:
        "SUBMITTED",

      userId:
        req.user.id,

      remarks:
        comment ||
        "Submitted by L3 user for final approval"
    });

    return res.json({
      success: true,

      message:
        "Purchase Order submitted for final approval.",

      data:
        po
    });
  }

  // ===================================================
  // L2 / L1
  //
  // ANY L2/L1 USER CAN FINALIZE ANY DRAFT/REJECTED PO
  //
  // Draft -> Approved
  // Rejected -> Approved
  //
  // No Approval Inbox required.
  // ===================================================

  if (
    isFinalApprovalAuthority(
      actingLevel
    )
  ) {
    po.status =
      PO_STATUS.APPROVED;

    po.approval.required =
      false;

    // =================================================
    // Record who finalized
    // =================================================

    po.approval.submittedBy =
      req.user.id;

    po.approval.submittedAt =
      new Date();

    po.approval.submitComment =
      comment;

    po.approval.submittedLevel =
      actingLevel;

    // =================================================
    // Direct final approval
    // =================================================

    po.approval.approvedBy =
      req.user.id;

    po.approval.approvedAt =
      new Date();

    po.approval.approvalComment =
      comment;

    po.approval.approvedLevel =
      actingLevel;

    // =================================================
    // CLEAR OLD REJECTION
    // =================================================

    po.approval.rejectedBy =
      null;

    po.approval.rejectedAt =
      null;

    po.approval.rejectionReason =
      "";

    po.approval.rejectedLevel =
      null;

    po.updatedBy =
      req.user.id;

    await po.save();

    await writeAudit({
      po,

      action:
        "APPROVED",

      userId:
        req.user.id,

      remarks:
        comment ||
        `PO finalized directly by ${actingLevel} final authority`
    });

    return res.json({
      success: true,

      message:
        `Purchase Order finalized by ${actingLevel} authority and marked Approved.`,

      data:
        po
    });
  }

  throw new ApiError(
    403,
    "Invalid PO approval level"
  );
};


// =====================================================
// APPROVE
//
// ONLY L2 OR L1
//
// PO MUST HAVE BEEN SUBMITTED BY L3
//
// NO AMOUNT LIMIT.
// =====================================================

exports.approve = async (req, res) => {
  // ===================================================
  // 1. FIND PO
  // ===================================================

  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  // ===================================================
  // 2. STATUS
  // ===================================================

  if (
    po.status !==
    PO_STATUS.PENDING_APPROVAL
  ) {
    throw new ApiError(
      409,
      "Only Pending Approval PO can be approved"
    );
  }

  // ===================================================
  // 3. CURRENT USER LEVEL
  // ===================================================

  const approverLevel =
    await getRequestUserApprovalLevel(
      req
    );

  // ===================================================
  // 4. ONLY L2 OR L1
  // ===================================================

  if (
    !isFinalApprovalAuthority(
      approverLevel
    )
  ) {
    throw new ApiError(
      403,
      "Only L2 or L1 final approval authority can approve Purchase Orders"
    );
  }

  // ===================================================
  // 5. CHECK ACTUAL SUBMISSION LEVEL
  //
  // IMPORTANT:
  //
  // DO NOT USE creatorApprovalLevel HERE.
  //
  // Example:
  //
  // L2 created Draft
  // L3 submitted Draft
  //
  // This PO must still be approvable.
  // ===================================================

  const submissionLevel =
    await getPOSubmissionLevel(
      po
    );

  if (
    submissionLevel !==
    APPROVAL_LEVEL.L3
  ) {
    throw new ApiError(
      409,
      "Only Purchase Orders submitted by L3 require final approval"
    );
  }

  // ===================================================
  // 6. APPROVE
  // ===================================================

  po.status =
    PO_STATUS.APPROVED;

  po.approval.approvedBy =
    req.user.id;

  po.approval.approvedAt =
    new Date();

  po.approval.approvalComment =
    req.body?.comment || "";

  po.approval.approvedLevel =
    approverLevel;

  // ===================================================
  // CLEAR REJECTION
  // ===================================================

  po.approval.rejectedBy =
    null;

  po.approval.rejectedAt =
    null;

  po.approval.rejectionReason =
    "";

  po.approval.rejectedLevel =
    null;

  po.updatedBy =
    req.user.id;

  await po.save();

  // ===================================================
  // 7. AUDIT
  // ===================================================

  await writeAudit({
    po,

    action:
      "APPROVED",

    userId:
      req.user.id,

    remarks:
      req.body?.comment ||
      `Final approval completed by ${approverLevel}`
  });

  // ===================================================
  // 8. RESPONSE
  // ===================================================

  return res.json({
    success: true,

    message:
      `Purchase Order approved by ${approverLevel} final authority.`,

    data:
      po
  });
};


// =====================================================
// REJECT
//
// ONLY L2 OR L1
//
// REASON IS REQUIRED.
// =====================================================

exports.reject = async (req, res) => {
  // ===================================================
  // 1. REASON
  // ===================================================

  const reason =
    String(
      req.body?.reason || ""
    ).trim();

  if (!reason) {
    throw new ApiError(
      400,
      "reason is required"
    );
  }

  // ===================================================
  // 2. FIND PO
  // ===================================================

  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  // ===================================================
  // 3. STATUS
  // ===================================================

  if (
    po.status !==
    PO_STATUS.PENDING_APPROVAL
  ) {
    throw new ApiError(
      409,
      "Only Pending Approval PO can be rejected"
    );
  }

  // ===================================================
  // 4. CURRENT USER LEVEL
  // ===================================================

  const rejectorLevel =
    await getRequestUserApprovalLevel(
      req
    );

  // ===================================================
  // 5. ONLY L2 OR L1
  // ===================================================

  if (
    !isFinalApprovalAuthority(
      rejectorLevel
    )
  ) {
    throw new ApiError(
      403,
      "Only L2 or L1 final approval authority can reject Purchase Orders"
    );
  }

  // ===================================================
  // 6. MUST HAVE BEEN SUBMITTED BY L3
  // ===================================================

  const submissionLevel =
    await getPOSubmissionLevel(
      po
    );

  if (
    submissionLevel !==
    APPROVAL_LEVEL.L3
  ) {
    throw new ApiError(
      409,
      "Only Purchase Orders submitted by L3 require approval or rejection"
    );
  }

  // ===================================================
  // 7. REJECT
  // ===================================================

  po.status =
    PO_STATUS.REJECTED;

  po.approval.rejectedBy =
    req.user.id;

  po.approval.rejectedAt =
    new Date();

  po.approval.rejectionReason =
    reason;

  po.approval.rejectedLevel =
    rejectorLevel;

  po.updatedBy =
    req.user.id;

  await po.save();

  // ===================================================
  // 8. AUDIT
  // ===================================================

  await writeAudit({
    po,

    action:
      "REJECTED",

    userId:
      req.user.id,

    remarks:
      reason
  });

  // ===================================================
  // 9. RESPONSE
  // ===================================================

  return res.json({
    success: true,

    message:
      `Purchase Order rejected by ${rejectorLevel} final authority.`,

    data:
      po
  });
};


// =====================================================
// ISSUE
// =====================================================

exports.issue = async (req, res) => {
  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  // ===================================================
  // APPROVED PO
  //
  // Works for:
  //
  // L3 -> L2 Approval
  // L3 -> L1 Approval
  // L2 Finalize
  // L1 Finalize
  // ===================================================

  if (
    po.status ===
    PO_STATUS.APPROVED
  ) {
    // Allowed
  }

  // ===================================================
  // EXISTING GLOBAL APPROVAL DISABLED BEHAVIOR
  // ===================================================

  else if (
    !po.approval.required &&
    !approvalRequired() &&
    po.status ===
      PO_STATUS.DRAFT
  ) {
    // Allowed
  }

  else {
    throw new ApiError(
      409,
      "Approved status is required before issue"
    );
  }

  po.status =
    PO_STATUS.ISSUED;

  po.updatedBy =
    req.user.id;

  await po.save();

  await writeAudit({
    po,

    action:
      "ISSUED",

    userId:
      req.user.id
  });

  return res.json({
    success: true,
    data: po
  });
};


// =====================================================
// REVISE
// =====================================================

exports.revise = async (req, res) => {
  // ===================================================
  // 1. REASON
  // ===================================================

  const reason =
    String(
      req.body?.reason || ""
    ).trim();

  if (!reason) {
    throw new ApiError(
      400,
      "revision reason is required"
    );
  }

  // ===================================================
  // 2. SOURCE PO
  // ===================================================

  const source =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!source) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  if (
    source.status !==
    PO_STATUS.ISSUED
  ) {
    throw new ApiError(
      409,
      "Only Issued PO can be revised"
    );
  }

  // ===================================================
  // 3. NEXT REVISION
  // ===================================================

  const existing =
    await PurchaseOrder.findOne({
      poNumber:
        source.poNumber
    })
      .sort({
        revisionNo:
          -1
      })
      .lean();

  const nextRevision =
    Number(
      existing?.revisionNo ||
      source.revisionNo
    ) + 1;

  // ===================================================
  // 4. CLONE
  // ===================================================

  const clone =
    source.toObject();

  delete clone._id;
  delete clone.__v;
  delete clone.createdAt;
  delete clone.updatedAt;

  // ===================================================
  // 5. CURRENT REVISION CREATOR LEVEL
  // ===================================================

  const creatorApprovalLevel =
    await getRequestUserApprovalLevel(
      req
    );

  clone.revisionNo =
    nextRevision;

  clone.status =
    PO_STATUS.DRAFT;

  clone.parentRevisionId =
    source._id;

  clone.revisionReason =
    reason;

  // ===================================================
  // RESET PDF
  // ===================================================

  clone.pdf = {
    version:
      0,

    storageKey:
      "",

    generatedAt:
      null,

    generatedBy:
      null,

    hash:
      ""
  };

  // ===================================================
  // RESET APPROVAL
  // ===================================================

  clone.approval = {
    required:
      creatorApprovalLevel ===
        APPROVAL_LEVEL.L3
        ? approvalRequired()
        : false
  };

  clone.creatorApprovalLevel =
    creatorApprovalLevel;

  clone.createdBy =
    req.user.id;

  clone.updatedBy =
    req.user.id;

  // ===================================================
  // CREATE REVISION
  // ===================================================

  const revised =
    await PurchaseOrder.create(
      clone
    );

  // ===================================================
  // AUDIT SOURCE
  // ===================================================

  await writeAudit({
    po:
      source,

    action:
      "REVISION_CREATED",

    userId:
      req.user.id,

    remarks:
      `Created revision ${nextRevision}: ${reason}`
  });

  // ===================================================
  // AUDIT NEW REVISION
  // ===================================================

  await writeAudit({
    po:
      revised,

    action:
      "CREATED_FROM_REVISION",

    userId:
      req.user.id,

    remarks:
      reason
  });

  return res
    .status(201)
    .json({
      success: true,
      data: revised
    });
};


// =====================================================
// CANCEL
// =====================================================

exports.cancel = async (req, res) => {
  const reason =
    String(
      req.body?.reason || ""
    ).trim();

  if (!reason) {
    throw new ApiError(
      400,
      "cancellation reason is required"
    );
  }

  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  if (
    [
      PO_STATUS.CANCELLED,
      PO_STATUS.CLOSED
    ].includes(
      po.status
    )
  ) {
    throw new ApiError(
      409,
      `PO is already ${po.status}`
    );
  }

  po.status =
    PO_STATUS.CANCELLED;

  po.cancellationReason =
    reason;

  po.updatedBy =
    req.user.id;

  await po.save();

  await writeAudit({
    po,

    action:
      "CANCELLED",

    userId:
      req.user.id,

    remarks:
      reason
  });

  return res.json({
    success: true,
    data: po
  });
};


// =====================================================
// AUDIT
// =====================================================

exports.audit = async (req, res) => {
  const po =
    await PurchaseOrder.findById(
      req.params.id
    )
      .select("_id")
      .lean();

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  const data =
    await POAuditLog.find({
      poId:
        po._id
    })
      .populate(
        "changedBy",
        "name employeeCode email"
      )
      .sort({
        changedAt:
          1
      })
      .lean();

  return res.json({
    success: true,
    data
  });
};


// =====================================================
// PDF
// =====================================================

exports.pdf = async (req, res) => {
  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  const preview =
    String(
      req.query.preview || "false"
    ) === "true";

  const download =
    String(
      req.query.download || "false"
    ) === "true";

  // ===================================================
  // PREVIEW
  // ===================================================

  if (preview) {
    const buffer =
      await renderPdfBuffer(
        po,
        {
          preview:
            po.status !==
            PO_STATUS.ISSUED
        }
      );

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `${
        download
          ? "attachment"
          : "inline"
      }; filename="${po.poNumber}-preview.pdf"`
    );

    return res.send(
      buffer
    );
  }

  // ===================================================
  // OFFICIAL PDF
  // ===================================================

  if (
    po.status !==
    PO_STATUS.ISSUED
  ) {
    throw new ApiError(
      409,
      "Official PDF can only be generated for Issued PO"
    );
  }

  let fullPath =
    getStoredPdfPath(
      po.pdf?.storageKey
    );

  if (!fullPath) {
    const stored =
      await storeOfficialPdf(
        po,
        req.user.id
      );

    fullPath =
      stored.fullPath;

    await writeAudit({
      po,

      action:
        "PDF_GENERATED",

      userId:
        req.user.id,

      remarks:
        `PDF version ${stored.version}`
    });
  }

  return res[
    download
      ? "download"
      : "sendFile"
  ](fullPath);
};


// =====================================================
// REGENERATE PDF
// =====================================================

exports.regeneratePdf = async (
  req,
  res
) => {
  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  if (
    po.status !==
    PO_STATUS.ISSUED
  ) {
    throw new ApiError(
      409,
      "Only Issued PO PDF can be regenerated"
    );
  }

  const stored =
    await storeOfficialPdf(
      po,
      req.user.id
    );

  await writeAudit({
    po,

    action:
      "PDF_REGENERATED",

    userId:
      req.user.id,

    remarks:
      req.body?.reason ||
      `PDF version ${stored.version}`
  });

  return res.json({
    success: true,

    data: {
      version:
        stored.version,

      storageKey:
        stored.filename,

      hash:
        stored.hash,

      generatedAt:
        po.pdf.generatedAt
    }
  });
};


// =====================================================
// CLOSE
// =====================================================

exports.close = async (req, res) => {
  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  if (
    po.status !==
    PO_STATUS.ISSUED
  ) {
    throw new ApiError(
      409,
      "Only Issued PO can be closed"
    );
  }

  po.status =
    PO_STATUS.CLOSED;

  po.updatedBy =
    req.user.id;

  await po.save();

  await writeAudit({
    po,

    action:
      "CLOSED",

    userId:
      req.user.id,

    remarks:
      req.body?.remarks || ""
  });

  return res.json({
    success: true,
    data: po
  });
};


// =====================================================
// EMAIL
// =====================================================

exports.email = async (req, res) => {
  const nodemailer =
    require("nodemailer");

  const po =
    await PurchaseOrder.findById(
      req.params.id
    );

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  if (
    po.status !==
    PO_STATUS.ISSUED
  ) {
    throw new ApiError(
      409,
      "Only Issued PO can be emailed as official PO"
    );
  }

  // ===================================================
  // TO
  // ===================================================

  const to =
    Array.isArray(
      req.body?.to
    )
      ? req.body.to
      : String(
          req.body?.to || ""
        )
          .split(",")
          .map(
            (x) =>
              x.trim()
          )
          .filter(Boolean);

  // ===================================================
  // CC
  // ===================================================

  const cc =
    Array.isArray(
      req.body?.cc
    )
      ? req.body.cc
      : String(
          req.body?.cc || ""
        )
          .split(",")
          .map(
            (x) =>
              x.trim()
          )
          .filter(Boolean);

  if (!to.length) {
    throw new ApiError(
      400,
      "At least one recipient in 'to' is required"
    );
  }

  if (!process.env.SMTP_HOST) {
    throw new ApiError(
      503,
      "SMTP is not configured on the server"
    );
  }

  // ===================================================
  // PDF
  // ===================================================

  let pdfPath =
    getStoredPdfPath(
      po.pdf?.storageKey
    );

  if (!pdfPath) {
    const stored =
      await storeOfficialPdf(
        po,
        req.user.id
      );

    pdfPath =
      stored.fullPath;

    await writeAudit({
      po,

      action:
        "PDF_GENERATED",

      userId:
        req.user.id,

      remarks:
        `PDF version ${stored.version}`
    });
  }

  // ===================================================
  // SMTP
  // ===================================================

  const transporter =
    nodemailer.createTransport({
      host:
        process.env.SMTP_HOST,

      port:
        Number(
          process.env.SMTP_PORT ||
          587
        ),

      secure:
        String(
          process.env.SMTP_SECURE ||
          "false"
        ) === "true",

      auth:
        process.env.SMTP_USER
          ? {
              user:
                process.env.SMTP_USER,

              pass:
                process.env.SMTP_PASSWORD
            }
          : undefined
    });

  // ===================================================
  // SEND
  // ===================================================

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER,

    to,

    cc,

    subject:
      req.body?.subject ||
      `Purchase Order ${po.poNumber}${
        po.revisionNo
          ? ` Rev ${po.revisionNo}`
          : ""
      }`,

    text:
      req.body?.message ||
      `Dear Sir/Madam,

Please find attached Purchase Order ${po.poNumber}.

Regards,
${po.company.companyName}`,

    attachments: [
      {
        filename:
          `${po.poNumber}-R${po.revisionNo}.pdf`,

        path:
          pdfPath
      }
    ]
  });

  // ===================================================
  // AUDIT
  // ===================================================

  await writeAudit({
    po,

    action:
      "EMAIL_SENT",

    userId:
      req.user.id,

    remarks:
      `To: ${to.join(", ")}${
        cc.length
          ? `; CC: ${cc.join(", ")}`
          : ""
      }`
  });

  // ===================================================
  // RESPONSE
  // ===================================================

  return res.json({
    success: true,
    message:
      "PO email sent successfully"
  });
};
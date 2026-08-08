const fs = require("fs");
const PurchaseOrder = require("../models/PurchaseOrder");
const PaymentTerm = require("../models/PaymentTerm");
const POAuditLog = require("../models/POAuditLog");
const ApiError = require("../utils/ApiError");
const { PO_STATUS } = require("../constants/po");
const { reservePONumber } = require("../services/poNumberService");
const { buildMasterSnapshots, buildItemSnapshots, buildTermSnapshots } = require("../services/snapshotService");
const { calculatePO } = require("../services/poCalculationService");
const { writeAudit } = require("../services/auditService");
const { renderPdfBuffer, storeOfficialPdf, getStoredPdfPath } = require("../services/poPdfService");

function approvalRequired() {
  return String(process.env.PO_APPROVAL_REQUIRED || "true").toLowerCase() !== "false";
}

function hasPermission(req, key) {
  return req.user?.permissions?.includes("*") || req.user?.permissions?.includes(key);
}

function normalizeHeader(payload, snapshots, reqUser, existing = {}) {
  const h = { ...(existing || {}), ...(payload.header || {}) };
  return {
    quoteRefDocumentNo: h.quoteRefDocumentNo || "",
    documentType: h.documentType || "",
    confirmedBy: h.confirmedBy || "",
    projectDocumentNo: h.projectDocumentNo || snapshots.project?.projectDocumentNo || "",
    referenceNo: h.referenceNo || "",
    paymentSummary: h.paymentSummary || "",
    buyerName: h.buyerName || reqUser.name,
    buyerContact: h.buyerContact || reqUser.mobile || "",
    taxesDutiesText: h.taxesDutiesText || "EXTRA AT ACTUAL",
    supplierTaxNote: h.supplierTaxNote || "Supplier to ensure the Appropriate HSN & applicable Tax Rates as per applicable law.",
    specialNotes: h.specialNotes || "",
    authorizedSignatory: h.authorizedSignatory || snapshots.company.authorizedSignatoryText || "AUTHORISED SIGNATORY"
  };
}

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
      throw new ApiError(400, `${field} is required`);
    }
  }

  if (!payload.poDate) {
    throw new ApiError(400, "poDate is required");
  }
}

exports.list = async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 200);
  const filter = {};

  if (req.query.dateFrom || req.query.dateTo) {
    filter.poDate = {};
    if (req.query.dateFrom) filter.poDate.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) {
      const end = new Date(req.query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.poDate.$lte = end;
    }
  }
  if (req.query.vendorId) filter["vendor.vendorId"] = req.query.vendorId;
  if (req.query.projectId) filter["project.projectId"] = req.query.projectId;
  if (req.query.costCenterId) filter["costCenter.costCenterId"] = req.query.costCenterId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.poType) filter.poType = req.query.poType;
  if (req.query.purchaseType) filter.purchaseType = req.query.purchaseType;
  if (req.query.search) {
    const regex = new RegExp(req.query.search, "i");
    filter.$or = [
      { poNumber: regex },
      { "vendor.vendorName": regex },
      { "vendor.vendorCode": regex },
      { "project.projectCode": regex },
      { "project.projectName": regex }
    ];
  }

  const [data, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .select("poNumber revisionNo poDate documentHeading purchaseType poType currency vendor project costCenter totals status pdf createdAt updatedAt")
      .sort({ poDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PurchaseOrder.countDocuments(filter)
  ]);

  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

exports.getById = async (req, res) => {
  const data = await PurchaseOrder.findById(req.params.id)
    .populate("approval.submittedBy approval.approvedBy approval.rejectedBy", "name employeeCode email")
    .lean();
  if (!data) throw new ApiError(404, "Purchase Order not found");
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  const payload = req.body || {};

  // =====================================================
  // 1. VALIDATE BASIC PO DATA
  // =====================================================
  validateCreatePayload(payload);

  // =====================================================
  // 2. GET PAYMENT TERM FROM PAYMENT MASTER
  // =====================================================
  const paymentTerm = await PaymentTerm.findOne({
    _id: payload.paymentTermId,
    isActive: true
  });

  if (!paymentTerm) {
    throw new ApiError(
      400,
      "Valid Payment Term is required"
    );
  }

  // =====================================================
  // 3. BUILD MASTER SNAPSHOTS
  // =====================================================
  const snapshots = await buildMasterSnapshots(payload);

  const purchaseType =
    payload.purchaseType ||
    snapshots.vendor.purchaseType;

  const currency =
    payload.currency ||
    snapshots.vendor.currency ||
    "INR";

  const documentHeading =
    payload.documentHeading ||
    `${String(purchaseType).toUpperCase()} PURCHASE ORDER`;

  // =====================================================
  // 4. ITEMS
  // =====================================================
  const allowManual =
    hasPermission(req, "po.manual_item");

  const itemSnapshots =
    await buildItemSnapshots(
      payload.items || [],
      allowManual
    );

  // =====================================================
  // 5. TERMS
  // =====================================================
  const terms =
    await buildTermSnapshots(
      payload,
      snapshots.source.project
    );

  // =====================================================
  // 6. CALCULATION
  // =====================================================
  const calculated = calculatePO({
    items: itemSnapshots,
    charges: payload.charges,
    roundingOff:
      payload.roundingOff ??
      payload.totals?.roundingOff ??
      0,
    currency
  });

  // =====================================================
  // 7. PO NUMBER
  // =====================================================
  const poNumber =
    await reservePONumber(
      snapshots.company.companyId,
      payload.poDate
    );

  // =====================================================
  // 8. HEADER
  //
  // Payment Summary is NOT taken manually.
  // It comes from Payment Terms Master.
po.header = normalizeHeader(
  {
    ...payload,

    header: {
      ...(payload.header || {}),

      // ==================================
      // AUTO FROM PAYMENT MASTER
      // ==================================
      paymentSummary:
        paymentTerm.paymentSummary
    }
  },
  snapshots,
  req.user,
  po.toObject().header
);

  // =====================================================
  // 9. PAYMENT TERM SNAPSHOT
  // =====================================================
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

  // =====================================================
  // 10. CREATE PO
  // =====================================================
  const po = await PurchaseOrder.create({
    poNumber,

    revisionNo: 0,

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

    // ==========================================
    // NEW PAYMENT MASTER SNAPSHOT
    // ==========================================
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

    approval: {
      required:
        approvalRequired()
    },

    status:
      PO_STATUS.DRAFT,

    createdBy:
      req.user.id,

    updatedBy:
      req.user.id
  });

  // =====================================================
  // 11. AUDIT
  // =====================================================
  await writeAudit({
    po,
    action: "CREATED",
    userId: req.user.id,
    after: po.toObject()
  });

  return res.status(201).json({
    success: true,
    data: po
  });
};

exports.update = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);

  if (!po) {
    throw new ApiError(
      404,
      "Purchase Order not found"
    );
  }

  if (
    ![
      PO_STATUS.DRAFT,
      PO_STATUS.REJECTED
    ].includes(po.status)
  ) {
    throw new ApiError(
      409,
      `PO cannot be edited in ${po.status} status`
    );
  }

  // ==========================================
  // REQUEST PAYLOAD
  // Declare this ONLY ONCE
  // ==========================================
  const payload = req.body || {};

  // ==========================================
  // PAYMENT TERM
  // ==========================================
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
      _id: paymentTermId,
      isActive: true
    });

  if (!paymentTerm) {
    throw new ApiError(
      400,
      "Valid Payment Term is required"
    );
  }

  const before = po.toObject();

  // ==========================================
  // SOURCE PAYLOAD
  // ==========================================
  const sourcePayload = {
    ...payload,

    companyId:
      payload.companyId ||
      po.company.companyId,

    vendorId:
      payload.vendorId ||
      po.vendor.vendorId,

    deliveryAddressId:
      payload.deliveryAddressId ||
      po.delivery.deliveryAddressId,

    costCenterId:
      payload.costCenterId ||
      po.costCenter.costCenterId,

    projectId:
      payload.projectId !== undefined
        ? payload.projectId
        : po.project?.projectId,

    poType:
      payload.poType ||
      po.poType
  };

  const snapshots = await buildMasterSnapshots(sourcePayload);
  const purchaseType = payload.purchaseType || snapshots.vendor.purchaseType || po.purchaseType;
  const currency = payload.currency || snapshots.vendor.currency || po.currency;
  const allowManual = hasPermission(req, "po.manual_item");

  const rawItems = payload.items || po.items.map((i) => i.toObject());
  const itemSnapshots = await buildItemSnapshots(rawItems, allowManual);
  const termsPayload = {
    ...payload,
    specificTerms: payload.specificTerms || po.specificTerms.map((t) => t.toObject())
  };
  const terms = await buildTermSnapshots(termsPayload, snapshots.source.project);
  const calculated = calculatePO({
    items: itemSnapshots,
    charges: payload.charges || po.toObject().charges,
    roundingOff: payload.roundingOff ?? payload.totals?.roundingOff ?? po.totals.roundingOff,
    currency
  });

  po.poDate = payload.poDate || po.poDate;
  po.documentHeading = payload.documentHeading || `${String(purchaseType).toUpperCase()} PURCHASE ORDER`;
  po.purchaseType = purchaseType;
  po.poType = sourcePayload.poType;
  po.currency = currency;
  po.company = snapshots.company;
  po.vendor = snapshots.vendor;
  po.delivery = snapshots.delivery;
  po.costCenter = snapshots.costCenter;
  po.project = snapshots.project;
  po.header = normalizeHeader(payload, snapshots, req.user, po.toObject().header);
  if (!po.header.paymentSummary) throw new ApiError(400, "header.paymentSummary is required");
  po.items = calculated.items;
  po.charges = calculated.charges;
  po.totals = calculated.totals;
  po.specificTerms = terms.specificTerms;
  po.generalTerms = terms.generalTerms;
  po.status = PO_STATUS.DRAFT;
  po.approval.rejectedBy = null;
  po.approval.rejectedAt = null;
  po.approval.rejectionReason = "";
  po.updatedBy = req.user.id;
  await po.save();

  await writeAudit({ po, action: "UPDATED", userId: req.user.id, before, after: po.toObject() });
  res.json({ success: true, data: po });
};

exports.submit = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if (!po.approval.required) throw new ApiError(409, "Approval workflow is disabled; issue the Draft PO directly");
  if (![PO_STATUS.DRAFT, PO_STATUS.REJECTED].includes(po.status)) {
    throw new ApiError(409, `Only Draft/Rejected PO can be submitted; current status is ${po.status}`);
  }

  po.status = PO_STATUS.PENDING_APPROVAL;
  po.approval.submittedBy = req.user.id;
  po.approval.submittedAt = new Date();
  po.approval.submitComment = req.body?.comment || "";
  po.updatedBy = req.user.id;
  await po.save();
  await writeAudit({ po, action: "SUBMITTED", userId: req.user.id, remarks: req.body?.comment || "" });
  res.json({ success: true, data: po });
};

exports.approve = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if (po.status !== PO_STATUS.PENDING_APPROVAL) throw new ApiError(409, "Only Pending Approval PO can be approved");

  const limit = req.user.approvalLimit;
  if (limit !== null && limit !== undefined && Number(po.totals.grandTotal) > Number(limit)) {
    throw new ApiError(403, `PO total exceeds approval limit of ${limit}`);
  }

  po.status = PO_STATUS.APPROVED;
  po.approval.approvedBy = req.user.id;
  po.approval.approvedAt = new Date();
  po.approval.approvalComment = req.body?.comment || "";
  po.updatedBy = req.user.id;
  await po.save();
  await writeAudit({ po, action: "APPROVED", userId: req.user.id, remarks: req.body?.comment || "" });
  res.json({ success: true, data: po });
};

exports.reject = async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw new ApiError(400, "reason is required");
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if (po.status !== PO_STATUS.PENDING_APPROVAL) throw new ApiError(409, "Only Pending Approval PO can be rejected");

  po.status = PO_STATUS.REJECTED;
  po.approval.rejectedBy = req.user.id;
  po.approval.rejectedAt = new Date();
  po.approval.rejectionReason = reason;
  po.updatedBy = req.user.id;
  await po.save();
  await writeAudit({ po, action: "REJECTED", userId: req.user.id, remarks: reason });
  res.json({ success: true, data: po });
};

exports.issue = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");

  if (po.approval.required) {
    if (po.status !== PO_STATUS.APPROVED) throw new ApiError(409, "Approved status is required before issue");
  } else if (po.status !== PO_STATUS.DRAFT) {
    throw new ApiError(409, "Only Draft PO can be directly issued when approval is disabled");
  }

  po.status = PO_STATUS.ISSUED;
  po.updatedBy = req.user.id;
  await po.save();
  await writeAudit({ po, action: "ISSUED", userId: req.user.id });
  res.json({ success: true, data: po });
};

exports.revise = async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw new ApiError(400, "revision reason is required");
  const source = await PurchaseOrder.findById(req.params.id);
  if (!source) throw new ApiError(404, "Purchase Order not found");
  if (source.status !== PO_STATUS.ISSUED) throw new ApiError(409, "Only Issued PO can be revised");

  const existing = await PurchaseOrder.findOne({ poNumber: source.poNumber }).sort({ revisionNo: -1 }).lean();
  const nextRevision = Number(existing?.revisionNo || source.revisionNo) + 1;
  const clone = source.toObject();
  delete clone._id;
  delete clone.__v;
  delete clone.createdAt;
  delete clone.updatedAt;

  clone.revisionNo = nextRevision;
  clone.status = PO_STATUS.DRAFT;
  clone.parentRevisionId = source._id;
  clone.revisionReason = reason;
  clone.pdf = { version: 0, storageKey: "", generatedAt: null, generatedBy: null, hash: "" };
  clone.approval = { required: approvalRequired() };
  clone.createdBy = req.user.id;
  clone.updatedBy = req.user.id;

  const revised = await PurchaseOrder.create(clone);
  await writeAudit({ po: source, action: "REVISION_CREATED", userId: req.user.id, remarks: `Created revision ${nextRevision}: ${reason}` });
  await writeAudit({ po: revised, action: "CREATED_FROM_REVISION", userId: req.user.id, remarks: reason });
  res.status(201).json({ success: true, data: revised });
};

exports.cancel = async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw new ApiError(400, "cancellation reason is required");
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if ([PO_STATUS.CANCELLED, PO_STATUS.CLOSED].includes(po.status)) {
    throw new ApiError(409, `PO is already ${po.status}`);
  }
  po.status = PO_STATUS.CANCELLED;
  po.cancellationReason = reason;
  po.updatedBy = req.user.id;
  await po.save();
  await writeAudit({ po, action: "CANCELLED", userId: req.user.id, remarks: reason });
  res.json({ success: true, data: po });
};

exports.audit = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id).select("_id").lean();
  if (!po) throw new ApiError(404, "Purchase Order not found");
  const data = await POAuditLog.find({ poId: po._id }).populate("changedBy", "name employeeCode email").sort({ changedAt: 1 }).lean();
  res.json({ success: true, data });
};

exports.pdf = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  const preview = String(req.query.preview || "false") === "true";
  const download = String(req.query.download || "false") === "true";

  if (preview) {
    const buffer = await renderPdfBuffer(po, { preview: po.status !== PO_STATUS.ISSUED });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${po.poNumber}-preview.pdf"`);
    return res.send(buffer);
  }

  if (po.status !== PO_STATUS.ISSUED) throw new ApiError(409, "Official PDF can only be generated for Issued PO");

  let fullPath = getStoredPdfPath(po.pdf?.storageKey);
  if (!fullPath) {
    const stored = await storeOfficialPdf(po, req.user.id);
    fullPath = stored.fullPath;
    await writeAudit({ po, action: "PDF_GENERATED", userId: req.user.id, remarks: `PDF version ${stored.version}` });
  }
  return res[download ? "download" : "sendFile"](fullPath);
};

exports.regeneratePdf = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if (po.status !== PO_STATUS.ISSUED) throw new ApiError(409, "Only Issued PO PDF can be regenerated");

  const stored = await storeOfficialPdf(po, req.user.id);
  await writeAudit({ po, action: "PDF_REGENERATED", userId: req.user.id, remarks: req.body?.reason || `PDF version ${stored.version}` });
  res.json({
    success: true,
    data: {
      version: stored.version,
      storageKey: stored.filename,
      hash: stored.hash,
      generatedAt: po.pdf.generatedAt
    }
  });
};

exports.close = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if (po.status !== PO_STATUS.ISSUED) throw new ApiError(409, "Only Issued PO can be closed");
  po.status = PO_STATUS.CLOSED;
  po.updatedBy = req.user.id;
  await po.save();
  await writeAudit({ po, action: "CLOSED", userId: req.user.id, remarks: req.body?.remarks || "" });
  res.json({ success: true, data: po });
};

exports.email = async (req, res) => {
  const nodemailer = require("nodemailer");
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if (po.status !== PO_STATUS.ISSUED) throw new ApiError(409, "Only Issued PO can be emailed as official PO");

  const to = Array.isArray(req.body?.to) ? req.body.to : String(req.body?.to || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cc = Array.isArray(req.body?.cc) ? req.body.cc : String(req.body?.cc || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!to.length) throw new ApiError(400, "At least one recipient in 'to' is required");
  if (!process.env.SMTP_HOST) throw new ApiError(503, "SMTP is not configured on the server");

  let pdfPath = getStoredPdfPath(po.pdf?.storageKey);
  if (!pdfPath) {
    const stored = await storeOfficialPdf(po, req.user.id);
    pdfPath = stored.fullPath;
    await writeAudit({ po, action: "PDF_GENERATED", userId: req.user.id, remarks: `PDF version ${stored.version}` });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    cc,
    subject: req.body?.subject || `Purchase Order ${po.poNumber}${po.revisionNo ? ` Rev ${po.revisionNo}` : ""}`,
    text: req.body?.message || `Dear Sir/Madam,\n\nPlease find attached Purchase Order ${po.poNumber}.\n\nRegards,\n${po.company.companyName}`,
    attachments: [{ filename: `${po.poNumber}-R${po.revisionNo}.pdf`, path: pdfPath }]
  });

  await writeAudit({ po, action: "EMAIL_SENT", userId: req.user.id, remarks: `To: ${to.join(", ")}${cc.length ? `; CC: ${cc.join(", ")}` : ""}` });
  res.json({ success: true, message: "PO email sent successfully" });
};

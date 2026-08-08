const path = require("path");
const PurchaseOrder = require("../models/PurchaseOrder");
const POAttachment = require("../models/POAttachment");
const ApiError = require("../utils/ApiError");

exports.upload = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");
  if (!req.file) throw new ApiError(400, "file is required");

  const attachment = await POAttachment.create({
    poId: po._id,
    fileType: req.body.fileType || "Supporting Document",
    originalName: req.file.originalname,
    storageKey: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user.id
  });
  res.status(201).json({ success: true, data: attachment });
};

exports.list = async (req, res) => {
  const data = await POAttachment.find({ poId: req.params.id }).sort({ uploadedAt: -1 }).lean();
  res.json({ success: true, data });
};

exports.download = async (req, res) => {
  const attachment = await POAttachment.findById(req.params.attachmentId).lean();
  if (!attachment || String(attachment.poId) !== String(req.params.id)) {
    throw new ApiError(404, "Attachment not found");
  }
  const root = path.resolve(process.cwd(), process.env.ATTACHMENT_STORAGE_DIR || "storage/attachments");
  res.download(path.join(root, path.basename(attachment.storageKey)), attachment.originalName);
};

const express = require("express");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requirePermission = require("../middleware/requirePermission");
const upload = require("../middleware/upload");
const P = require("../constants/permissions");
const po = require("../controllers/purchaseOrderController");
const attachment = require("../controllers/attachmentController");

const router = express.Router();
router.use(auth);

router.get("/", requirePermission(P.PO_READ, P.PO_CREATE, P.PO_APPROVE), asyncHandler(po.list));
router.post("/", requirePermission(P.PO_CREATE), asyncHandler(po.create));
router.get("/:id", requirePermission(P.PO_READ, P.PO_CREATE, P.PO_APPROVE), asyncHandler(po.getById));
router.put("/:id", requirePermission(P.PO_UPDATE, P.PO_CREATE), asyncHandler(po.update));

router.post("/:id/submit", requirePermission(P.PO_SUBMIT, P.PO_CREATE), asyncHandler(po.submit));
router.post("/:id/approve", requirePermission(P.PO_APPROVE), asyncHandler(po.approve));
router.post("/:id/reject", requirePermission(P.PO_REJECT, P.PO_APPROVE), asyncHandler(po.reject));
router.post("/:id/issue", requirePermission(P.PO_ISSUE), asyncHandler(po.issue));
router.post("/:id/revise", requirePermission(P.PO_REVISE), asyncHandler(po.revise));
router.post("/:id/cancel", requirePermission(P.PO_CANCEL), asyncHandler(po.cancel));
router.post("/:id/close", requirePermission(P.PO_ISSUE), asyncHandler(po.close));

router.get("/:id/pdf", requirePermission(P.PO_PDF, P.PO_READ), asyncHandler(po.pdf));
router.post("/:id/pdf/regenerate", requirePermission(P.PO_PDF, P.PO_ISSUE), asyncHandler(po.regeneratePdf));
router.post("/:id/email", requirePermission(P.PO_ISSUE), asyncHandler(po.email));
router.get("/:id/audit", requirePermission(P.PO_AUDIT, P.PO_READ), asyncHandler(po.audit));

router.post("/:id/attachments", requirePermission(P.PO_ATTACHMENT, P.PO_CREATE), upload.single("file"), asyncHandler(attachment.upload));
router.get("/:id/attachments", requirePermission(P.PO_READ, P.PO_ATTACHMENT), asyncHandler(attachment.list));
router.get("/:id/attachments/:attachmentId/download", requirePermission(P.PO_READ, P.PO_ATTACHMENT), asyncHandler(attachment.download));

module.exports = router;

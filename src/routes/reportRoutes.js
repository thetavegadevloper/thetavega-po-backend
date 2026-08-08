const express = require("express");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requirePermission = require("../middleware/requirePermission");
const P = require("../constants/permissions");
const report = require("../controllers/reportController");

const router = express.Router();
router.use(auth, requirePermission(P.REPORT_READ, P.PO_READ));
router.get("/purchase-orders", asyncHandler(report.report));
router.get("/purchase-orders/export", asyncHandler(report.exportReport));
module.exports = router;

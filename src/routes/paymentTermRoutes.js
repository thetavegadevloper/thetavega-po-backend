const express = require("express");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requirePermission = require("../middleware/requirePermission");
const P = require("../constants/permissions");

const paymentTerm =
  require("../controllers/paymentTermController");

const router = express.Router();

router.use(auth);

router.get(
  "/",
  requirePermission(
    P.PAYMENT_READ,
    P.PAYMENT_WRITE
  ),
  asyncHandler(
    paymentTerm.getPaymentTerms
  )
);

router.post(
  "/",
  requirePermission(
    P.PAYMENT_WRITE
  ),
  asyncHandler(
    paymentTerm.createPaymentTerm
  )
);

router.put(
  "/:id",
  requirePermission(
    P.PAYMENT_WRITE
  ),
  asyncHandler(
    paymentTerm.updatePaymentTerm
  )
);

module.exports = router;
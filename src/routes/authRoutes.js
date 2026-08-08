const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const auth = require("../middleware/auth");
const controller = require("../controllers/authController");

const router = express.Router();
router.post("/login", asyncHandler(controller.login));
router.get("/me", auth, asyncHandler(controller.me));
module.exports = router;

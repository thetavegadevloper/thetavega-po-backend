const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const health = require("../controllers/healthController");

const router = express.Router();
router.get("/", asyncHandler(health.health));
router.get("/db", asyncHandler(health.database));

module.exports = router;

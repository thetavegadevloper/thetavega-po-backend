const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const masterRoutes = require("./routes/masterRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const reportRoutes = require("./routes/reportRoutes");
const paymentTermRoutes = require("./routes/paymentTermRoutes");

// =====================================================
// GRIDFS ATTACHMENT ROUTE
// =====================================================
const attachmentRoutes = require("./routes/attachmentRoutes");

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// =====================================================
// SECURITY
// =====================================================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// =====================================================
// CORS
// =====================================================
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : null;

app.use(
  cors({
    origin: allowedOrigins || true,
    credentials: true,
  })
);

// =====================================================
// BODY PARSER
// =====================================================
app.use(
  express.json({
    limit: "3mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "3mb",
  })
);

// =====================================================
// REQUEST LOGGING
// =====================================================
app.use(
  morgan(
    process.env.NODE_ENV === "production"
      ? "combined"
      : "dev"
  )
);

// =====================================================
// GRIDFS ATTACHMENT FILE ACCESS
//
// Public URL:
//
// /attachments/filename.pdf
//
// Example:
//
// http://localhost:5000/attachments/123-GST.pdf
//
// Render:
//
// https://thetavega-po-backend.onrender.com/attachments/123-GST.pdf
//
// IMPORTANT:
// Must remain BEFORE notFound middleware.
// =====================================================
app.use(
  "/attachments",
  attachmentRoutes
);

// =====================================================
// ROUTES
// =====================================================

// -----------------------------------------------------
// HEALTH
// -----------------------------------------------------
app.use(
  "/api/health",
  healthRoutes
);

// -----------------------------------------------------
// AUTH
// -----------------------------------------------------
app.use(
  "/api/auth",
  authRoutes
);

// -----------------------------------------------------
// MASTER ROUTES
// -----------------------------------------------------
app.use(
  "/api",
  masterRoutes
);

// -----------------------------------------------------
// PURCHASE ORDERS
// -----------------------------------------------------
app.use(
  "/api/purchase-orders",
  purchaseOrderRoutes
);

// -----------------------------------------------------
// REPORTS
// -----------------------------------------------------
app.use(
  "/api/reports",
  reportRoutes
);

// -----------------------------------------------------
// PAYMENT TERMS
// -----------------------------------------------------
app.use(
  "/api/payment-terms",
  paymentTermRoutes
);

// =====================================================
// 404 HANDLER
//
// IMPORTANT:
// Keep after ALL application routes.
// =====================================================
app.use(notFound);

// =====================================================
// GLOBAL ERROR HANDLER
//
// MUST BE LAST
// =====================================================
app.use(errorHandler);

// =====================================================
// EXPORT
// =====================================================
module.exports = app;
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const masterRoutes = require("./routes/masterRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const paymentTermRoutes =
  require("./routes/paymentTermRoutes");

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN?.split(",") ||
      true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "3mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  morgan(
    process.env.NODE_ENV === "production"
      ? "combined"
      : "dev"
  )
);

// =====================================================
// ATTACHMENT FILE ACCESS
//
// Same directory used by vendorUpload.js
//
// Example:
// /attachments/1754818200-abc123-GST.pdf
// =====================================================

const attachmentRoot =
  path.resolve(
    process.cwd(),
    process.env.ATTACHMENT_STORAGE_DIR ||
      "storage/attachments"
  );

app.use(
  "/attachments",
  express.static(
    attachmentRoot
  )
);

// =====================================================
// ROUTES
// =====================================================

app.use(
  "/api/health",
  healthRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api",
  masterRoutes
);

app.use(
  "/api/purchase-orders",
  purchaseOrderRoutes
);

app.use(
  "/api/reports",
  reportRoutes
);

app.use(
  "/api/payment-terms",
  paymentTermRoutes
);

// =====================================================
// ERROR HANDLING
// =====================================================

app.use(
  notFound
);

app.use(
  errorHandler
);

module.exports = app;
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// =====================================================
// ATTACHMENT STORAGE DIRECTORY
// =====================================================
const root = path.resolve(
  process.cwd(),
  process.env.ATTACHMENT_STORAGE_DIR ||
    "storage/attachments"
);

fs.mkdirSync(root, {
  recursive: true
});

// =====================================================
// STORAGE CONFIGURATION
// =====================================================
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, root);
  },

  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    cb(
      null,
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}-${safe}`
    );
  }
});

// =====================================================
// MULTER CONFIGURATION
// =====================================================
const upload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];

    if (
      !allowed.includes(
        file.mimetype
      )
    ) {
      return cb(
        new Error(
          "Unsupported attachment type"
        )
      );
    }

    cb(null, true);
  }
});

// =====================================================
// VENDOR FILE FIELDS
// =====================================================
//
// gstCertificate  -> 1 GST Certificate
// panCard         -> 1 PAN Card
// supportingFiles -> Maximum 10 supporting documents
//
// =====================================================
const vendorUpload = upload.fields([
  {
    name: "gstCertificate",
    maxCount: 1
  },

  {
    name: "panCard",
    maxCount: 1
  },

  {
    name: "supportingFiles",
    maxCount: 10
  }
]);

// =====================================================
// EXPORT
// =====================================================
module.exports = vendorUpload;
const multer = require("multer");

// =====================================================
// VENDOR UPLOAD
//
// Files stay temporarily in memory.
// Vendor Controller will save file.buffer to GridFS.
// =====================================================

// =====================================================
// MEMORY STORAGE
// =====================================================
const storage = multer.memoryStorage();

// =====================================================
// FILE FILTER
// =====================================================
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  return cb(
    new Error(
      "Only PDF, JPG, JPEG, PNG, XLS and XLSX files are allowed"
    ),
    false
  );
};

// =====================================================
// MULTER INSTANCE
// =====================================================
const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// =====================================================
// VENDOR FILE FIELDS
//
// This itself is now an Express middleware function.
// =====================================================
const vendorUpload = upload.fields([
  {
    name: "gstCertificate",
    maxCount: 1,
  },
  {
    name: "panCard",
    maxCount: 1,
  },
  {
    name: "supportingFiles",
    maxCount: 10,
  },
]);

// =====================================================
// EXPORT
// =====================================================
module.exports = vendorUpload;
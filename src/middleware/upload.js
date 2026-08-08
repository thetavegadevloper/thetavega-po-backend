const fs = require("fs");
const path = require("path");
const multer = require("multer");

const root = path.resolve(process.cwd(), process.env.ATTACHMENT_STORAGE_DIR || "storage/attachments");
fs.mkdirSync(root, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, root),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error("Unsupported attachment type"));
    cb(null, true);
  }
});

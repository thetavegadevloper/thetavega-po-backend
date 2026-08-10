const express = require("express");

const {
  getGridFSBucket,
} = require("../utils/gridFsStorage");

const router = express.Router();

// =====================================================
// GET ATTACHMENT FROM MONGODB GRIDFS
//
// URL:
//
// GET /attachments/:filename
//
// Example:
//
// /attachments/1786356254755-abc123-GST.pdf
//
// app.js already mounts this router as:
//
// app.use("/attachments", attachmentRoutes);
// =====================================================
router.get(
  "/:filename",
  async (req, res, next) => {
    try {
      // =================================================
      // FILE NAME
      // =================================================
      const fileName = String(
        req.params.filename || ""
      ).trim();

      if (!fileName) {
        return res.status(400).json({
          success: false,
          message: "Attachment filename is required",
        });
      }

      // =================================================
      // GET GRIDFS BUCKET
      // =================================================
      const bucket =
        getGridFSBucket();

      // =================================================
      // FIND FILE INFORMATION
      // =================================================
      const files =
        await bucket
          .find({
            filename: fileName,
          })
          .sort({
            uploadDate: -1,
          })
          .limit(1)
          .toArray();

      // =================================================
      // FILE NOT FOUND
      // =================================================
      if (
        !files ||
        files.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Attachment not found",
        });
      }

      const file =
        files[0];

      // =================================================
      // MIME TYPE
      // =================================================
      const mimetype =
        file.metadata?.mimetype ||
        "application/octet-stream";

      // =================================================
      // ORIGINAL FILE NAME
      // =================================================
      const originalName = String(
        file.metadata
          ?.originalName ||
          file.filename ||
          "attachment"
      ).replace(
        /["\r\n]/g,
        ""
      );

      // =================================================
      // RESPONSE HEADERS
      // =================================================
      res.setHeader(
        "Content-Type",
        mimetype
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${originalName}"`
      );

      res.setHeader(
        "Cross-Origin-Resource-Policy",
        "cross-origin"
      );

      if (
        Number(
          file.length ||
          0
        ) > 0
      ) {
        res.setHeader(
          "Content-Length",
          String(
            file.length
          )
        );
      }

      // =================================================
      // OPEN GRIDFS DOWNLOAD STREAM
      // =================================================
      const downloadStream =
        bucket.openDownloadStream(
          file._id
        );

      // =================================================
      // STREAM ERROR
      // =================================================
      downloadStream.on(
        "error",
        (error) => {
          if (
            !res.headersSent
          ) {
            return res
              .status(404)
              .json({
                success: false,
                message:
                  "Attachment could not be read",
              });
          }

          res.destroy(
            error
          );
        }
      );

      // =================================================
      // STREAM FILE TO BROWSER
      // =================================================
      downloadStream.pipe(
        res
      );
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// EXPORT
// =====================================================
module.exports = router;
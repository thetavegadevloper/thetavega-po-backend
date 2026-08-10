const mongoose = require("mongoose");

// =====================================================
// GRIDFS BUCKET NAME
//
// MongoDB will automatically create:
//
// vendorAttachments.files
// vendorAttachments.chunks
// =====================================================
const BUCKET_NAME = "vendorAttachments";

// =====================================================
// GRIDFS BUCKET INSTANCE
// =====================================================
let gridFsBucket = null;

// =====================================================
// GET GRIDFS BUCKET
//
// Uses the SAME MongoDB connection already created
// by mongoose.connect() in your application.
// =====================================================
function getGridFSBucket() {
  // ---------------------------------------------------
  // Ensure MongoDB is connected
  // ---------------------------------------------------
  if (
    mongoose.connection.readyState !== 1 ||
    !mongoose.connection.db
  ) {
    throw new Error(
      "MongoDB is not connected. GridFS is unavailable."
    );
  }

  // ---------------------------------------------------
  // Reuse existing bucket
  // ---------------------------------------------------
  if (gridFsBucket) {
    return gridFsBucket;
  }

  // ---------------------------------------------------
  // Create GridFS bucket
  // ---------------------------------------------------
  gridFsBucket =
    new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      {
        bucketName: BUCKET_NAME,
      }
    );

  return gridFsBucket;
}

// =====================================================
// SAFE FILE NAME
// =====================================================
function sanitizeFileName(fileName = "file") {
  return String(fileName)
    .replace(/\s+/g, "-")
    .replace(
      /[^a-zA-Z0-9._-]/g,
      ""
    );
}

// =====================================================
// GENERATE UNIQUE STORED FILE NAME
// =====================================================
function generateStoredFileName(
  originalName
) {
  const safeOriginalName =
    sanitizeFileName(
      originalName
    );

  const randomPart =
    Math.random()
      .toString(36)
      .substring(2, 10);

  return `${Date.now()}-${randomPart}-${safeOriginalName}`;
}

// =====================================================
// UPLOAD FILE BUFFER TO GRIDFS
//
// Input comes from multer.memoryStorage():
//
// file.buffer
// file.originalname
// file.mimetype
// file.size
//
// Returns metadata that can be saved inside Vendor.
// =====================================================
function uploadFileToGridFS(file) {
  return new Promise(
    (resolve, reject) => {
      // -------------------------------------------------
      // Validate file
      // -------------------------------------------------
      if (
        !file ||
        !file.buffer
      ) {
        return reject(
          new Error(
            "Valid file buffer is required"
          )
        );
      }

      try {
        const bucket =
          getGridFSBucket();

        const storedFileName =
          generateStoredFileName(
            file.originalname
          );

        const uploadedAt =
          new Date();

        // -----------------------------------------------
        // OPEN GRIDFS UPLOAD STREAM
        // -----------------------------------------------
        const uploadStream =
          bucket.openUploadStream(
            storedFileName,
            {
              metadata: {
                originalName:
                  file.originalname,

                mimetype:
                  file.mimetype,

                size:
                  Number(
                    file.size ||
                      file.buffer.length ||
                      0
                  ),

                uploadedAt,
              },
            }
          );

        // -----------------------------------------------
        // UPLOAD ERROR
        // -----------------------------------------------
        uploadStream.on(
          "error",
          (error) => {
            reject(error);
          }
        );

        // -----------------------------------------------
        // UPLOAD COMPLETE
        // -----------------------------------------------
        uploadStream.on(
          "finish",
          () => {
            resolve({
              // MongoDB GridFS ID
              gridFsId:
                String(
                  uploadStream.id
                ),

              // Original uploaded file
              originalName:
                file.originalname,

              // Unique GridFS filename
              fileName:
                storedFileName,

              // Public URL that frontend already uses
              url:
                `/attachments/${encodeURIComponent(
                  storedFileName
                )}`,

              mimetype:
                file.mimetype,

              size:
                Number(
                  file.size ||
                    file.buffer.length ||
                    0
                ),

              uploadedAt,
            });
          }
        );

        // -----------------------------------------------
        // WRITE FILE BUFFER TO MONGODB
        // -----------------------------------------------
        uploadStream.end(
          file.buffer
        );
      } catch (error) {
        reject(error);
      }
    }
  );
}

// =====================================================
// EXPORT
// =====================================================
module.exports = {
  getGridFSBucket,
  uploadFileToGridFS,
};
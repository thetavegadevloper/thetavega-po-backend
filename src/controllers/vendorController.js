const Vendor = require("../models/Vendor");
const ApiError = require("../utils/ApiError");

const {
  uploadFileToGridFS,
} = require("../utils/gridFsStorage");

// =====================================================
// BUILD SEARCH
// Same behavior as existing master factory
// =====================================================
function buildSearch(search, fields) {
  if (!search || !fields?.length) {
    return {};
  }

  const regex = new RegExp(
    String(search).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    ),
    "i"
  );

  return {
    $or: fields.map((field) => ({
      [field]: regex,
    })),
  };
}

// =====================================================
// PARSE JSON FIELD
//
// Multipart/form-data sends objects/arrays as strings.
// This keeps registeredAddress and contacts working.
// =====================================================
function parseJsonField(
  value,
  fallback
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value ===
    "object"
  ) {
    return value;
  }

  try {
    return JSON.parse(
      value
    );
  } catch {
    return fallback;
  }
}

// =====================================================
// NORMALIZE BODY
// =====================================================
function normalizeVendorBody(
  body = {}
) {
  const data = {
    ...body,
  };

  // ===================================================
  // REGISTERED ADDRESS
  // ===================================================
  if (
    body.registeredAddress !==
    undefined
  ) {
    data.registeredAddress =
      parseJsonField(
        body.registeredAddress,
        {}
      );
  }

  // ===================================================
  // CONTACTS
  // ===================================================
  if (
    body.contacts !==
    undefined
  ) {
    data.contacts =
      parseJsonField(
        body.contacts,
        []
      );
  }

  // ===================================================
  // ACTIVE FLAG
  // ===================================================
  if (
    body.isActive !==
    undefined
  ) {
    data.isActive =
      body.isActive === true ||
      body.isActive ===
        "true";
  }

  // ===================================================
  // IMPORTANT
  //
  // File fields must come only from req.files.
  // ===================================================
  delete data.gstCertificate;
  delete data.panCard;
  delete data.supportingFiles;

  return data;
}

// =====================================================
// LIST VENDORS
// =====================================================
exports.list = async (
  req,
  res
) => {
  const page =
    Math.max(
      Number(
        req.query.page ||
          1
      ),
      1
    );

  const limit =
    Math.min(
      Math.max(
        Number(
          req.query.limit ||
            50
        ),
        1
      ),
      200
    );

  const filter = {
    ...buildSearch(
      req.query.search,
      [
        "vendorName",
        "vendorCode",
        "gstNo",
        "panNo",
      ]
    ),
  };

  if (
    req.query.isActive !==
    undefined
  ) {
    filter.isActive =
      req.query.isActive ===
      "true";
  }

  const [
    data,
    total,
  ] = await Promise.all([
    Vendor.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(
        (page - 1) *
          limit
      )
      .limit(limit)
      .lean(),

    Vendor.countDocuments(
      filter
    ),
  ]);

  res.json({
    success: true,

    data,

    pagination: {
      page,
      limit,
      total,

      pages:
        Math.ceil(
          total / limit
        ),
    },
  });
};

// =====================================================
// GET VENDOR BY ID
// =====================================================
exports.getById = async (
  req,
  res
) => {
  const data =
    await Vendor.findById(
      req.params.id
    ).lean();

  if (!data) {
    throw new ApiError(
      404,
      "Vendor not found"
    );
  }

  res.json({
    success: true,
    data,
  });
};

// =====================================================
// CREATE VENDOR
// =====================================================
exports.create = async (
  req,
  res
) => {
  const vendorData =
    normalizeVendorBody(
      req.body
    );

  // ===================================================
  // GST CERTIFICATE
  //
  // Upload actual file to MongoDB GridFS.
  // Store returned metadata in Vendor.
  // ===================================================
  const gstCertificate =
    req.files
      ?.gstCertificate?.[0];

  if (
    gstCertificate
  ) {
    vendorData.gstCertificate =
      await uploadFileToGridFS(
        gstCertificate
      );
  }

  // ===================================================
  // PAN CARD
  // ===================================================
  const panCard =
    req.files
      ?.panCard?.[0];

  if (
    panCard
  ) {
    vendorData.panCard =
      await uploadFileToGridFS(
        panCard
      );
  }

  // ===================================================
  // SUPPORTING FILES
  // ===================================================
  const supportingFiles =
    req.files
      ?.supportingFiles ||
    [];

  if (
    supportingFiles.length
  ) {
    vendorData.supportingFiles =
      await Promise.all(
        supportingFiles.map(
          (file) =>
            uploadFileToGridFS(
              file
            )
        )
      );
  } else {
    vendorData.supportingFiles =
      [];
  }

  // ===================================================
  // CREATE VENDOR
  // ===================================================
  const data =
    await Vendor.create(
      vendorData
    );

  res.status(201).json({
    success: true,
    data,
  });
};

// =====================================================
// UPDATE VENDOR
// =====================================================
exports.update = async (
  req,
  res
) => {
  const vendor =
    await Vendor.findById(
      req.params.id
    );

  if (!vendor) {
    throw new ApiError(
      404,
      "Vendor not found"
    );
  }

  const vendorData =
    normalizeVendorBody(
      req.body
    );

  // ===================================================
  // UPDATE NORMAL VENDOR DATA
  // ===================================================
  Object.keys(
    vendorData
  ).forEach(
    (key) => {
      vendor[key] =
        vendorData[key];
    }
  );

  // ===================================================
  // GST CERTIFICATE
  //
  // If new file uploaded:
  // - upload new file to GridFS
  // - replace Vendor metadata
  //
  // Existing GST remains unchanged if no new file.
  // ===================================================
  const gstCertificate =
    req.files
      ?.gstCertificate?.[0];

  if (
    gstCertificate
  ) {
    const gstMetadata =
      await uploadFileToGridFS(
        gstCertificate
      );

    vendor.gstCertificate =
      gstMetadata;
  }

  // ===================================================
  // PAN CARD
  //
  // Existing PAN remains unchanged if no new file.
  // ===================================================
  const panCard =
    req.files
      ?.panCard?.[0];

  if (
    panCard
  ) {
    const panMetadata =
      await uploadFileToGridFS(
        panCard
      );

    vendor.panCard =
      panMetadata;
  }

  // ===================================================
  // SUPPORTING FILES
  //
  // New supporting files are ADDED.
  //
  // Existing supporting files remain.
  // ===================================================
  const newSupportingFiles =
    req.files
      ?.supportingFiles ||
    [];

  if (
    newSupportingFiles.length
  ) {
    const metadata =
      await Promise.all(
        newSupportingFiles.map(
          (file) =>
            uploadFileToGridFS(
              file
            )
        )
      );

    vendor.supportingFiles = [
      ...(
        vendor.supportingFiles ||
        []
      ),
      ...metadata,
    ];
  }

  // ===================================================
  // SAVE
  // ===================================================
  await vendor.save();

  res.json({
    success: true,
    data: vendor,
  });
};

// =====================================================
// SET STATUS
// Same behavior as existing master factory
// =====================================================
exports.setStatus = async (
  req,
  res
) => {
  if (
    typeof req.body
      ?.isActive !==
    "boolean"
  ) {
    throw new ApiError(
      400,
      "isActive boolean is required"
    );
  }

  const data =
    await Vendor.findByIdAndUpdate(
      req.params.id,

      {
        isActive:
          req.body.isActive,
      },

      {
        new: true,
        runValidators: true,
      }
    );

  if (!data) {
    throw new ApiError(
      404,
      "Vendor not found"
    );
  }

  res.json({
    success: true,
    data,
  });
};
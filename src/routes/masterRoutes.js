const express = require("express");

const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requirePermission = require("../middleware/requirePermission");

const P = require("../constants/permissions");

const factory = require("../controllers/masterControllerFactory");
const userController = require("../controllers/userController");

// =====================================================
// MASTER AUTO CODE CONTROLLER
//
// IMPORTANT:
//
// GET /master-code/next
// is now PREVIEW ONLY.
//
// It DOES NOT increment the sequence.
//
// Actual increment happens only inside CREATE:
// - Company controller
// - Vendor controller
// - masterControllerFactory
// =====================================================
const masterSequenceController = require(
  "../controllers/masterSequenceController"
);

// =====================================================
// VENDOR FILE UPLOAD
// =====================================================
const vendorController = require("../controllers/vendorController");
const vendorUpload = require("../middleware/vendorUpload");

// =====================================================
// COMPANY CONTROLLER
//
// Also contains shared:
//
// GST lookup
// State -> City
// City -> Area / Post Office
// =====================================================
const companyController = require("../controllers/companyController");

// =====================================================
// MODELS
// =====================================================
const CostCenter = require("../models/CostCenter");
const Project = require("../models/Project");
const Material = require("../models/Material");
const DeliveryAddress = require("../models/DeliveryAddress");
const POTerm = require("../models/POTerm");
const Role = require("../models/Role");

// =====================================================
// ROUTER
// =====================================================
const router = express.Router();

router.use(auth);

// =====================================================
// MASTER CODE PREVIEW
//
// IMPORTANT:
//
// THIS API DOES NOT RESERVE OR INCREMENT A CODE.
//
// It only displays what the next code would be.
//
// Example:
//
// Current vendor sequence:
//
// value = 10
//
// GET:
//
// /api/master-code/next?master=vendors
//
// Response:
//
// TT11
//
// Database sequence remains:
//
// value = 10
//
// If user closes / cancels Add Vendor:
//
// Nothing changes.
//
// If user opens Add Vendor again:
//
// Still TT11.
//
// Sequence increments ONLY when POST /vendors succeeds.
//
// =====================================================
//
// USED BY:
//
// Company
// Vendor
// Material
// Project
// Cost Center
// Delivery Address
// Payment Terms
// PO Terms
//
// EXAMPLES:
//
// GET /api/master-code/next?master=vendors
// -> TT01
//
// GET /api/master-code/next?master=companies
// -> CMP01
//
// GET /api/master-code/next?master=materials
// -> MAT001
// =====================================================
router.get(
  "/master-code/next",
  requirePermission(
    P.COMPANY_WRITE,
    P.VENDOR_WRITE,
    P.MATERIAL_WRITE,
    P.PROJECT_WRITE,
    P.COST_CENTER_WRITE,
    P.DELIVERY_WRITE,
    P.PAYMENT_WRITE,
    P.TERM_WRITE
  ),
  asyncHandler(
    masterSequenceController.getNextCode
  )
);

// =====================================================
// COMMON MASTER REGISTER
// =====================================================
function register(
  path,
  controller,
  readPermission,
  writePermission
) {
  // ===================================================
  // LIST
  // ===================================================
  router.get(
    path,
    requirePermission(
      readPermission,
      writePermission
    ),
    asyncHandler(
      controller.list
    )
  );

  // ===================================================
  // CREATE
  //
  // IMPORTANT:
  //
  // For auto-code masters, actual sequence allocation
  // happens inside controller.create().
  //
  // Simply opening Add form never reaches this route.
  // ===================================================
  router.post(
    path,
    requirePermission(
      writePermission
    ),
    asyncHandler(
      controller.create
    )
  );

  // ===================================================
  // GET BY ID
  // ===================================================
  router.get(
    `${path}/:id`,
    requirePermission(
      readPermission,
      writePermission
    ),
    asyncHandler(
      controller.getById
    )
  );

  // ===================================================
  // UPDATE
  //
  // Auto-generated code remains unchanged.
  // ===================================================
  router.put(
    `${path}/:id`,
    requirePermission(
      writePermission
    ),
    asyncHandler(
      controller.update
    )
  );

  // ===================================================
  // STATUS
  // ===================================================
  router.patch(
    `${path}/:id/status`,
    requirePermission(
      writePermission
    ),
    asyncHandler(
      controller.setStatus
    )
  );
}

// =====================================================
// COMPANY / GST / ADDRESS COMMON LOOKUPS
//
// These lookup APIs are shared by:
//
// Company
// Vendor
// Delivery Address
//
// FLOW:
//
// GSTIN
//   ↓
// PAN
// GST State
// GST State Code
//
// Address:
//
// State
//   ↓
// City Dropdown
//   ↓
// Area / Post Office Dropdown
//   ↓
// District
// Pincode
// State Code
// Country
//
// IMPORTANT:
//
// Special routes MUST remain before:
//
// /companies/:id
// =====================================================

// =====================================================
// GST LOOKUP
//
// USED BY:
//
// Company:
// gstin -> pan
//
// Vendor:
// gstNo -> panNo
//
// Delivery Address:
// gstNo -> panNo
//
// Example:
//
// GET
// /api/companies/gst/27ABCDE1234F1Z5
//
// RETURNS:
//
// PAN
// GST State
// GST State Code
// =====================================================
router.get(
  "/companies/gst/:gstin",
  requirePermission(
    P.COMPANY_READ,
    P.COMPANY_WRITE,
    P.VENDOR_READ,
    P.VENDOR_WRITE,
    P.DELIVERY_READ,
    P.DELIVERY_WRITE
  ),
  asyncHandler(
    companyController.lookupGST
  )
);

// =====================================================
// GET CITIES BY STATE
//
// USED BY:
//
// Company
// Vendor
// Delivery Address
//
// Example:
//
// GET
// /api/companies/location/cities?state=Maharashtra
// =====================================================
router.get(
  "/companies/location/cities",
  requirePermission(
    P.COMPANY_READ,
    P.COMPANY_WRITE,
    P.VENDOR_READ,
    P.VENDOR_WRITE,
    P.DELIVERY_READ,
    P.DELIVERY_WRITE
  ),
  asyncHandler(
    companyController.getCities
  )
);

// =====================================================
// GET AREA / POST OFFICE BY CITY
//
// USED BY:
//
// Company
// Vendor
// Delivery Address
//
// Example:
//
// GET
// /api/companies/location/areas
// ?state=Maharashtra
// &city=Pune
// =====================================================
router.get(
  "/companies/location/areas",
  requirePermission(
    P.COMPANY_READ,
    P.COMPANY_WRITE,
    P.VENDOR_READ,
    P.VENDOR_WRITE,
    P.DELIVERY_READ,
    P.DELIVERY_WRITE
  ),
  asyncHandler(
    companyController.getAreas
  )
);

// =====================================================
// COMPANY LIST
// =====================================================
router.get(
  "/companies",
  requirePermission(
    P.COMPANY_READ,
    P.COMPANY_WRITE
  ),
  asyncHandler(
    companyController.list
  )
);

// =====================================================
// COMPANY CREATE
//
// Actual Company Code allocation:
// allocateNextCode("companies")
//
// happens inside companyController.create().
// =====================================================
router.post(
  "/companies",
  requirePermission(
    P.COMPANY_WRITE
  ),
  asyncHandler(
    companyController.create
  )
);

// =====================================================
// COMPANY GET BY ID
//
// IMPORTANT:
//
// Keep AFTER:
//
// /companies/gst/:gstin
// /companies/location/cities
// /companies/location/areas
// =====================================================
router.get(
  "/companies/:id",
  requirePermission(
    P.COMPANY_READ,
    P.COMPANY_WRITE
  ),
  asyncHandler(
    companyController.getById
  )
);

// =====================================================
// COMPANY UPDATE
//
// Existing Company Code remains unchanged.
// =====================================================
router.put(
  "/companies/:id",
  requirePermission(
    P.COMPANY_WRITE
  ),
  asyncHandler(
    companyController.update
  )
);

// =====================================================
// COMPANY STATUS
// =====================================================
router.patch(
  "/companies/:id/status",
  requirePermission(
    P.COMPANY_WRITE
  ),
  asyncHandler(
    companyController.setStatus
  )
);

// =====================================================
// COST CENTER
//
// Auto code allocated on CREATE:
// CC01, CC02...
// =====================================================
register(
  "/cost-centers",
  factory(
    CostCenter,
    {
      searchFields: [
        "costCenterName",
        "costCenterCode"
      ]
    }
  ),
  P.COST_CENTER_READ,
  P.COST_CENTER_WRITE
);

// =====================================================
// PROJECT
//
// Auto code allocated on CREATE:
// PRJ01, PRJ02...
// =====================================================
register(
  "/projects",
  factory(
    Project,
    {
      searchFields: [
        "projectName",
        "projectCode",
        "customerName"
      ]
    }
  ),
  P.PROJECT_READ,
  P.PROJECT_WRITE
);

// =====================================================
// VENDOR
//
// Vendor handled separately because:
//
// gstCertificate
// panCard
// supportingFiles
//
// use multipart file upload.
//
// Auto Vendor Code:
//
// TT01
// TT02
//
// is allocated ONLY inside vendorController.create().
// =====================================================

// =====================================================
// LIST VENDORS
// =====================================================
router.get(
  "/vendors",
  requirePermission(
    P.VENDOR_READ,
    P.VENDOR_WRITE
  ),
  asyncHandler(
    vendorController.list
  )
);

// =====================================================
// CREATE VENDOR + FILES
//
// Actual sequence increment happens here through:
//
// vendorController.create()
// -> allocateNextCode("vendors")
// =====================================================
router.post(
  "/vendors",
  requirePermission(
    P.VENDOR_WRITE
  ),
  vendorUpload,
  asyncHandler(
    vendorController.create
  )
);

// =====================================================
// GET SINGLE VENDOR
// =====================================================
router.get(
  "/vendors/:id",
  requirePermission(
    P.VENDOR_READ,
    P.VENDOR_WRITE
  ),
  asyncHandler(
    vendorController.getById
  )
);

// =====================================================
// UPDATE VENDOR + OPTIONAL NEW FILES
//
// Existing Vendor Code remains unchanged.
// =====================================================
router.put(
  "/vendors/:id",
  requirePermission(
    P.VENDOR_WRITE
  ),
  vendorUpload,
  asyncHandler(
    vendorController.update
  )
);

// =====================================================
// VENDOR STATUS
// =====================================================
router.patch(
  "/vendors/:id/status",
  requirePermission(
    P.VENDOR_WRITE
  ),
  asyncHandler(
    vendorController.setStatus
  )
);

// =====================================================
// MATERIAL
//
// Auto code allocated on CREATE:
//
// MAT001
// MAT002
// =====================================================
register(
  "/materials",
  factory(
    Material,
    {
      searchFields: [
        "itemCode",
        "description",
        "make",
        "model"
      ]
    }
  ),
  P.MATERIAL_READ,
  P.MATERIAL_WRITE
);

// =====================================================
// DELIVERY ADDRESS
//
// Auto code allocated on CREATE:
//
// DEL01
// DEL02
// =====================================================
register(
  "/delivery-addresses",
  factory(
    DeliveryAddress,
    {
      searchFields: [
        "deliveryCode",
        "name",
        "storePersonName"
      ]
    }
  ),
  P.DELIVERY_READ,
  P.DELIVERY_WRITE
);

// =====================================================
// PO TERMS
//
// Auto code allocated on CREATE:
//
// TERM01
// TERM02
// =====================================================
register(
  "/po-terms",
  factory(
    POTerm,
    {
      searchFields: [
        "termCode",
        "title",
        "text"
      ],

      sort: {
        scope: 1,
        displayOrder: 1
      }
    }
  ),
  P.TERM_READ,
  P.TERM_WRITE
);

// =====================================================
// ROLES
//
// No auto-generated master code.
// =====================================================
register(
  "/roles",
  factory(
    Role,
    {
      searchFields: [
        "roleName"
      ]
    }
  ),
  P.ROLE_READ,
  P.ROLE_WRITE
);

// =====================================================
// USERS
//
// No master sequence code.
// =====================================================
register(
  "/users",
  userController,
  P.USER_READ,
  P.USER_WRITE
);

// =====================================================
// EXPORT
// =====================================================
module.exports = router;
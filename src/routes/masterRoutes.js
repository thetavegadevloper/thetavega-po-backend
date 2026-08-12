const express = require("express");

const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requirePermission = require("../middleware/requirePermission");

const P = require("../constants/permissions");

const factory = require("../controllers/masterControllerFactory");
const userController = require("../controllers/userController");

// =====================================================
// MASTER AUTO CODE CONTROLLER
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
// AUTO MASTER CODE
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
//
// RETURNS:
//
// Pune
// Mumbai
// Nagpur
// Nashik
// etc.
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
//
// RETURNS:
//
// Area / Post Office
// District
// Pincode
// State
// State Code
// Country
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
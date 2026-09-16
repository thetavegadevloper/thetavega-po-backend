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
const masterSequenceController =
  require("../controllers/masterSequenceController");

// =====================================================
// VENDOR
// =====================================================
const vendorController =
  require("../controllers/vendorController");

const vendorUpload =
  require("../middleware/vendorUpload");

// =====================================================
// COMPANY
// =====================================================
const companyController =
  require("../controllers/companyController");

// =====================================================
// MODELS
// =====================================================
const CostCenter =
  require("../models/CostCenter");

const Project =
  require("../models/Project");

const Material =
  require("../models/Material");

const DeliveryAddress =
  require("../models/DeliveryAddress");

// =====================================================
// IMPORTANT
// PAYMENT TERM MODEL
// =====================================================
const PaymentTerm =
  require("../models/PaymentTerm");

const POTerm =
  require("../models/POTerm");

const Role =
  require("../models/Role");

// =====================================================
// ROUTER
// =====================================================
const router =
  express.Router();

router.use(auth);

// =====================================================
// MASTER CODE PREVIEW
//
// IMPORTANT:
//
// This API is PREVIEW ONLY.
//
// Opening Add:
// -> displays next code
// -> does NOT increment sequence
//
// Saving:
// -> create controller calls allocateNextCode()
// -> sequence increments
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
// GST LOOKUP
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
// CITIES BY STATE
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
// AREAS / POST OFFICES
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
// Company controller itself calls:
//
// allocateNextCode("companies")
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
//
// CC01
// CC02
// CC03
// =====================================================
register(
  "/cost-centers",

  factory(
    CostCenter,
    {
      searchFields: [
        "costCenterName",
        "costCenterCode"
      ],

      autoCodeMaster:
        "cost-centers",

      autoCodeField:
        "costCenterCode"
    }
  ),

  P.COST_CENTER_READ,
  P.COST_CENTER_WRITE
);

// =====================================================
// PROJECT
//
// PRJ01
// PRJ02
// PRJ03
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
      ],

      autoCodeMaster:
        "projects",

      autoCodeField:
        "projectCode"
    }
  ),

  P.PROJECT_READ,
  P.PROJECT_WRITE
);

// =====================================================
// VENDOR LIST
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
// VENDOR CREATE
//
// Vendor controller itself calls:
//
// allocateNextCode("vendors")
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
// VENDOR GET BY ID
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
// VENDOR UPDATE
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
// MAT001
// MAT002
// MAT003
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
      ],

      autoCodeMaster:
        "materials",

      autoCodeField:
        "itemCode"
    }
  ),

  P.MATERIAL_READ,
  P.MATERIAL_WRITE
);

// =====================================================
// DELIVERY ADDRESS
//
// DEL01
// DEL02
// DEL03
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
      ],

      autoCodeMaster:
        "delivery-addresses",

      autoCodeField:
        "deliveryCode"
    }
  ),

  P.DELIVERY_READ,
  P.DELIVERY_WRITE
);

// =====================================================
// PAYMENT TERMS
//
// THIS WAS MISSING.
//
// PY001
// PY002
// PY003
//
// IMPORTANT:
//
// On Add:
// preview only.
//
// On Save:
// allocateNextCode("payment-terms")
//
// Backend overwrites frontend preview paymentCode.
// =====================================================
register(
  "/payment-terms",

  factory(
    PaymentTerm,
    {
      searchFields: [
        "paymentCode",
        "paymentName",
        "paymentSummary"
      ],

      sort: {
        displayOrder: 1,
        createdAt: -1
      },

      autoCodeMaster:
        "payment-terms",

      autoCodeField:
        "paymentCode"
    }
  ),

  P.PAYMENT_READ,
  P.PAYMENT_WRITE
);

// =====================================================
// PO TERMS
//
// TERM01
// TERM02
// TERM03
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
      },

      autoCodeMaster:
        "po-terms",

      autoCodeField:
        "termCode"
    }
  ),

  P.TERM_READ,
  P.TERM_WRITE
);

// =====================================================
// ROLES
//
// No auto code
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
module.exports =
  router;
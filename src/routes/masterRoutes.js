const express = require("express");

const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requirePermission = require("../middleware/requirePermission");

const P = require("../constants/permissions");

const factory = require("../controllers/masterControllerFactory");
const userController = require("../controllers/userController");

// =====================================================
// VENDOR FILE UPLOAD - NEW
// =====================================================
const vendorController = require("../controllers/vendorController");
const vendorUpload = require("../middleware/vendorUpload");

const Company = require("../models/Company");
const CostCenter = require("../models/CostCenter");
const Project = require("../models/Project");
const Vendor = require("../models/Vendor");
const Material = require("../models/Material");
const DeliveryAddress = require("../models/DeliveryAddress");
const POTerm = require("../models/POTerm");
const Role = require("../models/Role");

const router = express.Router();

router.use(auth);

// =====================================================
// COMMON MASTER REGISTER
// =====================================================
function register(
  path,
  controller,
  readPermission,
  writePermission
) {
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

  router.post(
    path,
    requirePermission(
      writePermission
    ),
    asyncHandler(
      controller.create
    )
  );

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

  router.put(
    `${path}/:id`,
    requirePermission(
      writePermission
    ),
    asyncHandler(
      controller.update
    )
  );

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
// COMPANY
// =====================================================
register(
  "/companies",
  factory(
    Company,
    {
      searchFields: [
        "companyName",
        "companyCode",
        "gstin"
      ]
    }
  ),
  P.COMPANY_READ,
  P.COMPANY_WRITE
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
// Vendor is handled separately because:
// gstCertificate
// panCard
// supportingFiles
//
// are multipart file uploads.
// =====================================================

// LIST VENDORS
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

// CREATE VENDOR + FILES
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

// GET SINGLE VENDOR
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

// UPDATE VENDOR + OPTIONAL NEW FILES
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

// VENDOR STATUS
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
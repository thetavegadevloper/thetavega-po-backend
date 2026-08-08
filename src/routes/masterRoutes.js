const express = require("express");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requirePermission = require("../middleware/requirePermission");
const P = require("../constants/permissions");
const factory = require("../controllers/masterControllerFactory");
const userController = require("../controllers/userController");

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

function register(path, controller, readPermission, writePermission) {
  router.get(path, requirePermission(readPermission, writePermission), asyncHandler(controller.list));
  router.post(path, requirePermission(writePermission), asyncHandler(controller.create));
  router.get(`${path}/:id`, requirePermission(readPermission, writePermission), asyncHandler(controller.getById));
  router.put(`${path}/:id`, requirePermission(writePermission), asyncHandler(controller.update));
  router.patch(`${path}/:id/status`, requirePermission(writePermission), asyncHandler(controller.setStatus));
}

register("/companies", factory(Company, { searchFields: ["companyName", "companyCode", "gstin"] }), P.COMPANY_READ, P.COMPANY_WRITE);
register("/cost-centers", factory(CostCenter, { searchFields: ["costCenterName", "costCenterCode"] }), P.COST_CENTER_READ, P.COST_CENTER_WRITE);
register("/projects", factory(Project, { searchFields: ["projectName", "projectCode", "customerName"] }), P.PROJECT_READ, P.PROJECT_WRITE);
register("/vendors", factory(Vendor, { searchFields: ["vendorName", "vendorCode", "gstNo"] }), P.VENDOR_READ, P.VENDOR_WRITE);
register("/materials", factory(Material, { searchFields: ["itemCode", "description", "make", "model"] }), P.MATERIAL_READ, P.MATERIAL_WRITE);
register("/delivery-addresses", factory(DeliveryAddress, { searchFields: ["deliveryCode", "name", "storePersonName"] }), P.DELIVERY_READ, P.DELIVERY_WRITE);
register("/po-terms", factory(POTerm, { searchFields: ["termCode", "title", "text"], sort: { scope: 1, displayOrder: 1 } }), P.TERM_READ, P.TERM_WRITE);
register("/roles", factory(Role, { searchFields: ["roleName"] }), P.ROLE_READ, P.ROLE_WRITE);
register("/users", userController, P.USER_READ, P.USER_WRITE);

module.exports = router;

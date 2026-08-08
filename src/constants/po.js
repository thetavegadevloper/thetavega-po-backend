const PO_STATUS = Object.freeze({
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  ISSUED: "Issued",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  CLOSED: "Closed"
});

const PURCHASE_TYPES = ["Domestic", "Import"];
const PO_TYPES = [
  "Project",
  "Material",
  "Service",
  "AMC",
  "Job Work",
  "Capital",
  "Consumable",
  "Subcontract"
];
const CHARGE_MODES = ["Inclusive", "At Actual", "Percent", "Fixed"];

module.exports = { PO_STATUS, PURCHASE_TYPES, PO_TYPES, CHARGE_MODES };

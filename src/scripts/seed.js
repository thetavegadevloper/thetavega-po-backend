require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Role = require("../models/Role");
const User = require("../models/User");
const POTerm = require("../models/POTerm");
const P = require("../constants/permissions");

const specificTerms = [
  ["SPEC_APPLICATION", "Application", "Application", "Project application / PO-specific application.", 1],
  ["SPEC_PACKING", "Packing", "Packing & Forwarding", "@ ACTUAL", 2],
  ["SPEC_FREIGHT", "Freight", "Freight Charges", "@ ACTUAL", 3],
  ["SPEC_DELIVERY", "Delivery", "Delivery Schedule", "Delivery of all items shall be strictly as per the schedule provided by ThetaVega through official communication.", 4],
  ["SPEC_PAYMENT", "Payment", "Payment Terms", "100 % AGAINST PI", 5],
  ["SPEC_WARRANTY", "Warranty", "Warranty", "Comprehensive warranty of 2 years from commissioning at the client site; manufacturing defects or performance issues shall be resolved at no additional cost.", 6],
  ["SPEC_SERVICE", "Service", "Service Support", "One year of free service support at the client site with response and resolution within 24 hours of service intimation.", 7],
  ["SPEC_TECH", "Technical", "Technical & Handholding Support", "Full technical support and handholding during installation, commissioning and system proving.", 8],
  ["SPEC_DOCUMENTATION", "Documentation", "Documentation", "Relevant drawings, datasheets and spare part details shall be shared with the Proforma Invoice before manufacturing starts.", 9],
  ["SPEC_CERT", "Certification", "Material Certification", "Supplied material and equipment shall comply with applicable standards and certification requirements.", 10],
  ["SPEC_GENERAL_COMPLIANCE", "General", "General Terms & Conditions Compliance", "Vendor shall comply with all General Terms & Conditions; deviations must be communicated in writing within 2 working days.", 11],
  ["SPEC_TRAINING", "Training", "Training", "Comprehensive training shall be provided to ThetaVega's technical team for installation, commissioning and proving.", 12],
  ["SPEC_SPECIAL", "Special", "Special Notes", "", 13]
];

const generalTerms = [
  ["GEN_01", "Technical Support", "Supplier shall provide complete technical assistance, handholding support and required documentation for successful installation, commissioning and operation."],
  ["GEN_02", "Documentation & Drawings", "Relevant drawings, technical specifications and bill of materials shall be shared with the Proforma Invoice and approved before manufacturing or dispatch."],
  ["GEN_03", "Pre-Dispatch Approval", "No material shall be dispatched without formal PDI clearance or written approval from ThetaVega."],
  ["GEN_04", "Compliance & Certification", "Goods shall conform to applicable industry, regulatory and safety standards, with certifications supplied wherever applicable."],
  ["GEN_05", "Safety Assurance", "Items shall comply with relevant safety norms and required safety declarations, test reports or checklists shall be submitted."],
  ["GEN_06", "Environmental Suitability", "Materials shall be suitable for typical Indian industrial temperature, humidity and dust conditions unless otherwise specified."],
  ["GEN_07", "Performance Guarantee", "The product shall meet stated performance parameters; shortfalls or quality issues may result in rejection and replacement at supplier cost."],
  ["GEN_08", "Design Customization", "Required minor design or cosmetic changes may be requested within the agreed project scope."],
  ["GEN_09", "Provisioning", "Supplier shall ensure required provisions for additional accessories or future expandability where mentioned in the requirement."],
  ["GEN_10", "Protective Features", "Items shall include appropriate overload, short-circuit, thermal, surge and data-integrity protections where required."],
  ["GEN_11", "Mechanical Standards", "Structural or enclosure components shall comply with required thickness, finish, ingress protection and aesthetic standards as applicable."],
  ["GEN_12", "Power/Data Backup", "Where applicable, systems shall provide data protection and continuity in case of power failure."],
  ["GEN_13", "Warranty", "A minimum 3-year warranty from commissioning is required unless otherwise specified by a PO-specific term."],
  ["GEN_14", "Post-Sale Support", "Supplier shall provide spare-parts availability and technical support for at least 5 years from supply at pre-agreed terms."],
  ["GEN_15", "Product Upgradability", "Where relevant, the product or system shall accommodate future capacity or performance upgrades."],
  ["GEN_16", "Reference of PO", "All correspondence, invoices, delivery challans and communications shall mention the official PO number and item codes."],
  ["GEN_17", "Adherence to Specification", "Supplied material shall match approved drawings and specifications; deviations require written approval."],
  ["GEN_18", "Confidentiality & IP Protection", "Technical drawings, designs and project details are proprietary and shall not be disclosed to third parties without written consent."],
  ["GEN_19", "Inspection & Replacement", "Goods will be inspected on receipt; defective or non-compliant items shall be replaced within 45 days at no additional cost."],
  ["GEN_20", "Payment Terms", "Advance or prior payment does not imply acceptance; final acceptance is subject to inspection, performance verification and approval."],
  ["GEN_21", "Delivery Commitment", "Delivery shall follow the mutually agreed schedule; changes or delays shall be communicated in writing and approved."],
  ["GEN_22", "Transportation", "Transportation shall be arranged by the supplier unless otherwise specified; freight for rejected or replacement items shall be borne by the supplier."],
  ["GEN_23", "Packing Standards", "Supplier shall provide suitable damage-proof packing; improperly packed material may be rejected."],
  ["GEN_24", "Storage & Cleanliness", "Components shall be stored under proper conditions and supplied clean, dust-free and usable."],
  ["GEN_25", "Handling and Protection", "Material shall be protected during loading, unloading and internal handling against dents, damage and contamination."],
  ["GEN_26", "Installation & Commissioning Support", "Where applicable, supplier shall support installation, commissioning and training and provide required tools, software and accessories."],
  ["GEN_27", "Force Majeure", "Neither party shall be liable for failure to perform obligations caused by events beyond its reasonable control."],
  ["GEN_28", "Jurisdiction", "Disputes arising from the PO shall be subject to courts in Chhatrapati Sambhajinagar (Aurangabad), Maharashtra."]
];

async function upsertRole(roleName, permissions, approvalLimit = null) {
  return Role.findOneAndUpdate(
    { roleName },
    { roleName, permissions, approvalLimit, isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seed() {
  await connectDB();

  const admin = await upsertRole("Admin", [P.ALL], null);
  await upsertRole("Buyer", [
    P.COMPANY_READ,
    P.COST_CENTER_READ,
    P.PROJECT_READ,
    P.VENDOR_READ,
    P.VENDOR_WRITE,
    P.MATERIAL_READ,
    P.MATERIAL_WRITE,
    P.DELIVERY_READ,
    P.TERM_READ,
    P.PO_READ,
    P.PO_CREATE,
    P.PO_UPDATE,
    P.PO_MANUAL_ITEM,
    P.PO_SUBMIT,
    P.PO_ISSUE,
    P.PO_REVISE,
    P.PO_CANCEL,
    P.PO_PDF,
    P.PO_ATTACHMENT,
    P.PO_AUDIT,
    P.REPORT_READ
  ]);
  await upsertRole("Approver", [P.PO_READ, P.PO_APPROVE, P.PO_REJECT, P.PO_PDF, P.PO_AUDIT, P.REPORT_READ]);
  await upsertRole("Viewer", [P.COMPANY_READ, P.COST_CENTER_READ, P.PROJECT_READ, P.VENDOR_READ, P.MATERIAL_READ, P.DELIVERY_READ, P.TERM_READ, P.PO_READ, P.PO_PDF, P.PO_AUDIT, P.REPORT_READ]);

  for (const [termCode, category, title, text, displayOrder] of specificTerms) {
    await POTerm.findOneAndUpdate(
      { termCode },
      {
        termCode,
        scope: "Specific",
        category,
        title,
        text: text || "Enter PO-specific text",
        displayOrder,
        mandatory: category !== "Special",
        canOverride: true,
        editablePerPO: true,
        isActive: true
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  for (let i = 0; i < generalTerms.length; i += 1) {
    const [termCode, title, text] = generalTerms[i];
    await POTerm.findOneAndUpdate(
      { termCode },
      {
        termCode,
        scope: "General",
        category: "General",
        title,
        text,
        displayOrder: i + 1,
        mandatory: true,
        canOverride: true,
        editablePerPO: false,
        isActive: true
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  const adminUserId = process.env.SEED_ADMIN_USER_ID || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe@123";
  const passwordHash = await bcrypt.hash(password, 12);

  await User.findOneAndUpdate(
    { userId: adminUserId },
    {
      employeeCode: process.env.SEED_ADMIN_EMPLOYEE_CODE || "ADMIN001",
      name: process.env.SEED_ADMIN_NAME || "System Administrator",
      email: process.env.SEED_ADMIN_EMAIL || "admin@thetavega.tech",
      userId: adminUserId,
      passwordHash,
      roleId: admin._id,
      department: "Administration",
      designation: "Administrator",
      isActive: true
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  console.log("[SEED] Roles, PO terms and admin user seeded successfully.");
  console.log(`[SEED] Admin userId: ${adminUserId}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("[SEED] Failed", error);
  process.exit(1);
});

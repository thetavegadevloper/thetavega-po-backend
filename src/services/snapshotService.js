const Company = require("../models/Company");
const Vendor = require("../models/Vendor");
const DeliveryAddress = require("../models/DeliveryAddress");
const CostCenter = require("../models/CostCenter");
const Project = require("../models/Project");
const Material = require("../models/Material");
const POTerm = require("../models/POTerm");
const ApiError = require("../utils/ApiError");

function plain(doc) {
  return doc ? doc.toObject({ depopulate: true }) : null;
}

async function activeById(Model, id, label) {
  if (!id) throw new ApiError(400, `${label} is required`);
  const doc = await Model.findOne({ _id: id, isActive: true });
  if (!doc) throw new ApiError(400, `Active ${label} not found`);
  return doc;
}

function companySnapshot(doc) {
  const d = plain(doc);
  return {
    companyId: d._id,
    companyCode: d.companyCode,
    companyName: d.companyName,
    gstin: d.gstin,
    pan: d.pan,
    cin: d.cin,
    stateCode: d.stateCode,
    gstState: d.gstState,
    registeredAddress: d.registeredAddress,
    contactNo: d.contactNo,
    email: d.email,
    website: d.website,
    logo: d.logo,
    authorizedSignatoryText: d.authorizedSignatoryText
  };
}

function vendorSnapshot(doc) {
  const d = plain(doc);
  return {
    vendorId: d._id,
    vendorCode: d.vendorCode,
    vendorName: d.vendorName,
    purchaseType: d.purchaseType,
    registeredAddress: d.registeredAddress,
    gstNo: d.gstNo,
    panNo: d.panNo,
    contacts: d.contacts || [],
    currency: d.currency
  };
}

function deliverySnapshot(doc) {
  const d = plain(doc);
  return {
    deliveryAddressId: d._id,
    deliveryCode: d.deliveryCode,
    name: d.name,
    registeredAddress: d.registeredAddress,
    gstNo: d.gstNo,
    panNo: d.panNo,
    landmark: d.landmark,
    storeContactNo: d.storeContactNo,
    storePersonName: d.storePersonName,
    email: d.email
  };
}

function costCenterSnapshot(doc) {
  const d = plain(doc);
  return {
    costCenterId: d._id,
    costCenterCode: d.costCenterCode,
    costCenterName: d.costCenterName,
    type: d.type
  };
}

function projectSnapshot(doc) {
  if (!doc) return null;
  const d = plain(doc);
  return {
    projectId: d._id,
    projectCode: d.projectCode,
    customerName: d.customerName,
    projectName: d.projectName,
    location: d.location,
    application: d.application,
    projectDocumentNo: d.projectDocumentNo
  };
}

async function buildMasterSnapshots(payload) {
  const [company, vendor, delivery, costCenter] = await Promise.all([
    activeById(Company, payload.companyId, "company"),
    activeById(Vendor, payload.vendorId, "vendor"),
    activeById(DeliveryAddress, payload.deliveryAddressId, "delivery address"),
    activeById(CostCenter, payload.costCenterId, "cost center")
  ]);

  let project = null;
  if (payload.projectId) project = await activeById(Project, payload.projectId, "project");
  if (payload.poType === "Project" && !project) throw new ApiError(400, "projectId is required for Project PO type");

  return {
    company: companySnapshot(company),
    vendor: vendorSnapshot(vendor),
    delivery: deliverySnapshot(delivery),
    costCenter: costCenterSnapshot(costCenter),
    project: projectSnapshot(project),
    source: { company, vendor, delivery, costCenter, project }
  };
}

async function buildItemSnapshots(items, allowManualItem = false) {
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, "At least one PO item is required");
  const ids = [...new Set(items.map((i) => i.materialId).filter(Boolean).map(String))];
  const materials = ids.length ? await Material.find({ _id: { $in: ids }, isActive: true }) : [];
  const map = new Map(materials.map((m) => [String(m._id), m]));

  return items.map((input, index) => {
    let base = {};
    if (input.materialId) {
      const material = map.get(String(input.materialId));
      if (!material) throw new ApiError(400, `Item ${index + 1}: active material not found`);
      base = {
        materialId: material._id,
        materialCode: material.itemCode,
        description: material.description,
        hsnSac: material.hsnSacCode,
        uom: material.uom,
        gstPercent: material.gstPercent,
        tdsPercent: material.tdsPercent
      };
    } else if (!allowManualItem) {
      throw new ApiError(403, `Item ${index + 1}: manual item permission is required`);
    }

    const merged = {
      ...base,
      ...input,
      srNo: Number(input.srNo || (index + 1) * 10)
    };

    if (!merged.materialCode || !merged.description || !merged.uom) {
      throw new ApiError(400, `Item ${index + 1}: materialCode, description and uom are required`);
    }
    return merged;
  });
}

function termSnapshot(term) {
  return {
    termId: term._id || term.termId || null,
    termCode: term.termCode || "",
    category: term.category || "General",
    title: term.title,
    text: term.text,
    displayOrder: Number(term.displayOrder),
    mandatory: term.mandatory !== false,
    canOverride: term.canOverride !== false
  };
}

async function buildTermSnapshots(payload, project) {
  const [specificMaster, generalMaster] = await Promise.all([
    POTerm.find({ scope: "Specific", isActive: true }).sort({ displayOrder: 1 }),
    POTerm.find({ scope: "General", isActive: true }).sort({ displayOrder: 1 })
  ]);

  let specific = specificMaster.map((t) => termSnapshot(t.toObject()));
  if (Array.isArray(payload.specificTerms) && payload.specificTerms.length) {
    const overrides = new Map(payload.specificTerms.map((t) => [String(t.termCode || t.title), t]));
    specific = specific.map((term) => {
      const override = overrides.get(String(term.termCode || term.title));
      return override ? termSnapshot({ ...term, ...override }) : term;
    });

    for (const custom of payload.specificTerms) {
      const key = String(custom.termCode || custom.title);
      if (!specific.some((t) => String(t.termCode || t.title) === key)) {
        specific.push(termSnapshot(custom));
      }
    }
  }

  if (project?.application) {
    const appIndex = specific.findIndex((t) => t.category === "Application" || t.title === "Application");
    const appTerm = {
      termId: appIndex >= 0 ? specific[appIndex].termId : null,
      termCode: appIndex >= 0 ? specific[appIndex].termCode : "SPEC_APPLICATION",
      category: "Application",
      title: "Application",
      text: project.application,
      displayOrder: appIndex >= 0 ? specific[appIndex].displayOrder : 1,
      mandatory: true,
      canOverride: true
    };
    if (appIndex >= 0) specific[appIndex] = appTerm;
    else specific.push(appTerm);
  }

  specific.sort((a, b) => a.displayOrder - b.displayOrder);
  const general = generalMaster.map((t) => termSnapshot(t.toObject()));
  return { specificTerms: specific, generalTerms: general };
}

module.exports = { buildMasterSnapshots, buildItemSnapshots, buildTermSnapshots };

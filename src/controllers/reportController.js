const PurchaseOrder = require("../models/PurchaseOrder");

function filters(query) {
  const f = {};
  if (query.dateFrom || query.dateTo) {
    f.poDate = {};
    if (query.dateFrom) f.poDate.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      d.setHours(23, 59, 59, 999);
      f.poDate.$lte = d;
    }
  }
  if (query.vendorId) f["vendor.vendorId"] = query.vendorId;
  if (query.projectId) f["project.projectId"] = query.projectId;
  if (query.costCenterId) f["costCenter.costCenterId"] = query.costCenterId;
  if (query.status) f.status = query.status;
  if (query.poType) f.poType = query.poType;
  if (query.purchaseType) f.purchaseType = query.purchaseType;
  return f;
}

exports.report = async (req, res) => {
  const data = await PurchaseOrder.find(filters(req.query))
    .select("poNumber revisionNo poDate vendor project costCenter purchaseType poType currency totals status")
    .sort({ poDate: -1 })
    .lean();
  res.json({ success: true, data });
};

function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replaceAll('"', '""')}"`;
}

exports.exportReport = async (req, res) => {
  const data = await PurchaseOrder.find(filters(req.query))
    .select("poNumber revisionNo poDate vendor project costCenter purchaseType poType currency totals status")
    .sort({ poDate: -1 })
    .lean();

  const headers = ["PO Number", "Revision", "PO Date", "Vendor Code", "Vendor", "Project Code", "Cost Center", "Purchase Type", "PO Type", "Currency", "Subtotal", "Tax", "Grand Total", "Status"];
  const rows = data.map((po) => [
    po.poNumber,
    po.revisionNo,
    new Date(po.poDate).toISOString().slice(0, 10),
    po.vendor?.vendorCode,
    po.vendor?.vendorName,
    po.project?.projectCode,
    po.costCenter?.costCenterCode,
    po.purchaseType,
    po.poType,
    po.currency,
    po.totals?.subTotal,
    po.totals?.taxTotal,
    po.totals?.grandTotal,
    po.status
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="purchase-order-report-${Date.now()}.csv"`);
  res.send(`\ufeff${csv}`);
};

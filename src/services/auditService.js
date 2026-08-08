const POAuditLog = require("../models/POAuditLog");

async function writeAudit({ po, action, userId, before = null, after = null, remarks = "" }) {
  return POAuditLog.create({
    poId: po._id,
    poNumber: po.poNumber,
    revisionNo: po.revisionNo,
    action,
    before,
    after,
    changedBy: userId,
    remarks
  });
}

module.exports = { writeAudit };

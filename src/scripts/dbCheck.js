require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const models = [
  require("../models/Company"),
  require("../models/CostCenter"),
  require("../models/Project"),
  require("../models/Vendor"),
  require("../models/Material"),
  require("../models/DeliveryAddress"),
  require("../models/POTerm"),
  require("../models/Role"),
  require("../models/User"),
  require("../models/PurchaseOrder"),
  require("../models/POSequence"),
  require("../models/POAuditLog"),
  require("../models/POAttachment")
];

async function run() {
  await connectDB();

  const ping = await mongoose.connection.db.admin().ping();
  if (ping?.ok !== 1) throw new Error("MongoDB ping did not return ok=1");

  console.log(`[DB-CHECK] Ping OK. Database: ${mongoose.connection.name}`);
  const rows = [];

  for (const Model of models) {
    // init() verifies/creates the collection indexes declared by the schema.
    await Model.init();
    const count = await Model.countDocuments({});
    const indexes = await Model.collection.indexes();
    rows.push({
      model: Model.modelName,
      collection: Model.collection.name,
      documents: count,
      indexes: indexes.length
    });
  }

  console.table(rows);

  const Role = mongoose.model("Role");
  const User = mongoose.model("User");
  const POTerm = mongoose.model("POTerm");
  const adminRole = await Role.findOne({ roleName: "Admin", isActive: true }).lean();
  const adminUser = await User.findOne({ userId: process.env.SEED_ADMIN_USER_ID || "admin", isActive: true }).lean();
  const specificTerms = await POTerm.countDocuments({ scope: "Specific", isActive: true });
  const generalTerms = await POTerm.countDocuments({ scope: "General", isActive: true });

  const seedChecks = {
    adminRole: Boolean(adminRole),
    adminUser: Boolean(adminUser),
    specificTerms,
    generalTerms
  };
  console.log("[DB-CHECK] Seed checks:", seedChecks);

  if (!adminRole || !adminUser) {
    throw new Error("Seed data is incomplete. Run: npm run seed");
  }
  if (specificTerms < 1 || generalTerms < 28) {
    throw new Error("PO terms seed is incomplete. Run: npm run seed");
  }

  console.log("[DB-CHECK] PASS - connection, indexes, collections and seed data are valid.");
}

run()
  .catch((error) => {
    console.error("[DB-CHECK] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });

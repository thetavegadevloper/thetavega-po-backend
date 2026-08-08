const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    projectCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    customerName: { type: String, required: true, trim: true, maxlength: 150 },
    projectName: { type: String, required: true, trim: true, maxlength: 150 },
    location: { type: String, trim: true, default: "" },
    budget: { type: Number, min: 0, default: 0 },
    application: { type: String, trim: true, default: "" },
    projectDescription: { type: String, trim: true, default: "" },
    projectDocumentNo: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", ProjectSchema);

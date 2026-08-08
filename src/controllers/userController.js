const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Role = require("../models/Role");
const ApiError = require("../utils/ApiError");

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
  if (req.query.search) {
    const r = new RegExp(req.query.search, "i");
    filter.$or = [{ name: r }, { email: r }, { userId: r }, { employeeCode: r }];
  }
  const data = await User.find(filter).populate("roleId", "roleName permissions approvalLimit isActive").sort({ name: 1 }).lean();
  res.json({ success: true, data });
};

exports.getById = async (req, res) => {
  const data = await User.findById(req.params.id).populate("roleId", "roleName permissions approvalLimit isActive").lean();
  if (!data) throw new ApiError(404, "User not found");
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  const { password, roleId, ...rest } = req.body || {};
  if (!password || password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
  const role = await Role.findOne({ _id: roleId, isActive: true });
  if (!role) throw new ApiError(400, "Active role not found");
  const passwordHash = await bcrypt.hash(password, 12);
  const data = await User.create({ ...rest, roleId, passwordHash });
  res.status(201).json({ success: true, data });
};

exports.update = async (req, res) => {
  const { password, passwordHash, ...updates } = req.body || {};
  if (updates.roleId) {
    const role = await Role.findOne({ _id: updates.roleId, isActive: true });
    if (!role) throw new ApiError(400, "Active role not found");
  }
  if (password) {
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
    updates.passwordHash = await bcrypt.hash(password, 12);
  }
  const data = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!data) throw new ApiError(404, "User not found");
  res.json({ success: true, data });
};

exports.setStatus = async (req, res) => {
  if (typeof req.body?.isActive !== "boolean") throw new ApiError(400, "isActive boolean is required");
  const data = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
  if (!data) throw new ApiError(404, "User not found");
  res.json({ success: true, data });
};

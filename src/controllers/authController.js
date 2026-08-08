const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h"
  });
}

exports.login = async (req, res) => {
  const { userId, password } = req.body || {};
  if (!userId || !password) throw new ApiError(400, "userId and password are required");

  const user = await User.findOne({ userId, isActive: true }).select("+passwordHash").populate("roleId");
  if (!user || !user.roleId?.isActive) throw new ApiError(401, "Invalid credentials");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  const token = signToken(user._id);
  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      employeeCode: user.employeeCode,
      name: user.name,
      email: user.email,
      userId: user.userId,
      mobile: user.mobile,
      department: user.department,
      designation: user.designation,
      role: {
        id: user.roleId._id,
        name: user.roleId.roleName,
        permissions: user.roleId.permissions,
        approvalLimit: user.roleId.approvalLimit
      }
    }
  });
};

exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

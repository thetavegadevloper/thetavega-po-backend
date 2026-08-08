const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

module.exports = async function auth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next(new ApiError(401, "Authentication required"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub).populate("roleId").lean();
    if (!user || !user.isActive || !user.roleId || !user.roleId.isActive) {
      return next(new ApiError(401, "User or role is inactive"));
    }

    req.user = {
      id: user._id,
      employeeCode: user.employeeCode,
      name: user.name,
      email: user.email,
      userId: user.userId,
      mobile: user.mobile,
      department: user.department,
      designation: user.designation,
      roleId: user.roleId._id,
      roleName: user.roleId.roleName,
      permissions: user.roleId.permissions || [],
      approvalLimit: user.roleId.approvalLimit
    };
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return next(new ApiError(401, "Invalid or expired token"));
    }
    next(error);
  }
};

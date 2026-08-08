const ApiError = require("../utils/ApiError");

module.exports = function requirePermission(...required) {
  return function permissionMiddleware(req, _res, next) {
    const permissions = req.user?.permissions || [];
    if (permissions.includes("*") || required.some((p) => permissions.includes(p))) {
      return next();
    }
    return next(new ApiError(403, `Permission denied. Required: ${required.join(" or ")}`));
  };
};

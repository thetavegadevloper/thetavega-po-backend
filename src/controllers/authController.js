const bcrypt =
  require("bcryptjs");

const jwt =
  require("jsonwebtoken");

const User =
  require("../models/User");

const ApiError =
  require("../utils/ApiError");

// =====================================================
// SIGN TOKEN
// =====================================================
function signToken(
  userId
) {
  return jwt.sign(
    {
      sub:
        String(
          userId
        )
    },

    process.env
      .JWT_SECRET,

    {
      expiresIn:
        process.env
          .JWT_EXPIRES_IN ||
        "8h"
    }
  );
}

// =====================================================
// BUILD FRONTEND USER OBJECT
//
// Keeps Login and /me response identical.
// =====================================================
function buildUserResponse(
  user
) {
  return {
    id:
      user._id,

    employeeCode:
      user.employeeCode,

    name:
      user.name,

    email:
      user.email,

    userId:
      user.userId,

    mobile:
      user.mobile,

    department:
      user.department,

    designation:
      user.designation,

    // =================================================
    // NEW
    // =================================================
    approvalLevel:
      user.approvalLevel ||
      "L3",

    role: {
      id:
        user.roleId?._id,

      name:
        user.roleId
          ?.roleName,

      permissions:
        user.roleId
          ?.permissions ||
        [],

      // Existing field kept.
      // Not used in the new PO approval flow.
      approvalLimit:
        user.roleId
          ?.approvalLimit ??
        null
    }
  };
}

// =====================================================
// LOGIN
// =====================================================
exports.login =
  async (
    req,
    res
  ) => {
    const {
      userId,
      password
    } =
      req.body ||
      {};

    if (
      !userId ||
      !password
    ) {
      throw new ApiError(
        400,
        "userId and password are required"
      );
    }

    // =================================================
    // FIND USER
    // =================================================
    const user =
      await User.findOne({
        userId,
        isActive: true
      })
        .select(
          "+passwordHash"
        )
        .populate(
          "roleId"
        );

    if (
      !user ||
      !user.roleId
        ?.isActive
    ) {
      throw new ApiError(
        401,
        "Invalid credentials"
      );
    }

    // =================================================
    // PASSWORD
    // =================================================
    const ok =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!ok) {
      throw new ApiError(
        401,
        "Invalid credentials"
      );
    }

    // =================================================
    // TOKEN
    // =================================================
    const token =
      signToken(
        user._id
      );

    // =================================================
    // RESPONSE
    // =================================================
    return res.json({
      success: true,

      token,

      user:
        buildUserResponse(
          user
        )
    });
  };

// =====================================================
// CURRENT LOGGED-IN USER
//
// Important:
// Do not simply return req.user here,
// because frontend must reliably receive approvalLevel.
// =====================================================
exports.me = async (req, res) => {
  const userId =
    req.user?.id ||
    req.user?._id;

  if (!userId) {
    throw new ApiError(
      401,
      "Authenticated user not found"
    );
  }

  const user =
    await User.findOne({
      _id:
        userId,

      isActive:
        true,
    }).populate(
      "roleId"
    );

  if (
    !user ||
    !user.roleId?.isActive
  ) {
    throw new ApiError(
      401,
      "User or assigned role is inactive"
    );
  }

  return res.json({
    success: true,

    user: {
      id:
        user._id,

      employeeCode:
        user.employeeCode,

      name:
        user.name,

      email:
        user.email,

      userId:
        user.userId,

      mobile:
        user.mobile,

      department:
        user.department,

      designation:
        user.designation,

      approvalLevel:
        user.approvalLevel ||
        "L3",

      role: {
        id:
          user.roleId._id,

        name:
          user.roleId.roleName,

        permissions:
          user.roleId.permissions,

        approvalLimit:
          user.roleId.approvalLimit,
      },
    },
  });
};
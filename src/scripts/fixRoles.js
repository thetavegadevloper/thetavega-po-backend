require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../config/db");

const Role = require("../models/Role");
const User = require("../models/User");

// =====================================================
// FIX ROLE MASTER
// =====================================================
async function fixRoles() {
  try {
    // ===================================================
    // CONNECT USING SAME CONNECTION AS BACKEND
    // ===================================================
    await connectDB();

    console.log(
      "[ROLE FIX] Database connected successfully"
    );

    // ===================================================
    // EXISTING ROLE NAME -> NEW ROLE NAME
    // ===================================================
    const roleMappings = [
      {
        oldName: "Viewer",
        newName: "Supervisor",
        approvalLevel: "L3",
      },
      {
        oldName: "Approver",
        newName: "Manager",
        approvalLevel: "L2",
      },
      {
        oldName: "Buyer",
        newName: "Director",
        approvalLevel: "L1",
      },
      {
        oldName: "Admin",
        newName: "Admin",
        approvalLevel: null,
      },
    ];

    // ===================================================
    // UPDATE EACH ROLE
    // ===================================================
    for (const mapping of roleMappings) {
      let role = await Role.findOne({
        roleName: mapping.oldName,
      });

      // =================================================
      // If old name no longer exists, find new name
      // =================================================
      if (!role) {
        role = await Role.findOne({
          roleName: mapping.newName,
        });
      }

      if (!role) {
        console.log(
          `[ROLE FIX] Role not found: ${mapping.oldName} / ${mapping.newName}`
        );

        continue;
      }

      const previousName =
        role.roleName;

      // =================================================
      // ALL APPLICATION ACCESS
      // =================================================
      role.permissions = ["*"];

      // =================================================
      // NO AMOUNT-BASED APPROVAL
      // =================================================
      role.approvalLimit = null;

      role.isActive = true;

      // =================================================
      // RENAME IF REQUIRED
      // =================================================
      role.roleName =
        mapping.newName;

      await role.save();

      console.log(
        `[ROLE FIX] ${previousName} -> ${role.roleName}`
      );

      console.log(
        `[ROLE FIX] ${role.roleName} permissions -> ["*"]`
      );

      // =================================================
      // UPDATE USERS BELONGING TO THIS ROLE
      // =================================================
      if (mapping.approvalLevel) {
        const result =
          await User.updateMany(
            {
              roleId: role._id,
            },
            {
              $set: {
                approvalLevel:
                  mapping.approvalLevel,
              },
            }
          );

        console.log(
          `[ROLE FIX] ${role.roleName} users -> ${mapping.approvalLevel}`
        );

        console.log(
          `[ROLE FIX] Users updated: ${result.modifiedCount}`
        );
      }
    }

    // ===================================================
    // IMPORTANT:
    // ALSO FORCE EVERY ROLE TO HAVE FULL ACCESS
    // ===================================================
    const fullAccessResult =
      await Role.updateMany(
        {},
        {
          $set: {
            permissions: ["*"],
            approvalLimit: null,
          },
        }
      );

    console.log(
      `[ROLE FIX] Full-access roles updated: ${fullAccessResult.modifiedCount}`
    );

    // ===================================================
    // DISPLAY FINAL ROLES
    // ===================================================
    const finalRoles =
      await Role.find({})
        .select(
          "roleName permissions approvalLimit isActive"
        )
        .sort({
          roleName: 1,
        })
        .lean();

    console.log(
      "\n=========================================="
    );

    console.log(
      "FINAL ROLE CONFIGURATION"
    );

    console.log(
      "=========================================="
    );

    console.log(
      JSON.stringify(
        finalRoles,
        null,
        2
      )
    );

    // ===================================================
    // DISPLAY USERS
    // ===================================================
    const users =
      await User.find({})
        .select(
          "name userId roleId approvalLevel isActive"
        )
        .populate(
          "roleId",
          "roleName permissions"
        )
        .lean();

    console.log(
      "\n=========================================="
    );

    console.log(
      "FINAL USER CONFIGURATION"
    );

    console.log(
      "=========================================="
    );

    users.forEach((user) => {
      console.log({
        name:
          user.name,

        userId:
          user.userId,

        role:
          user.roleId?.roleName,

        approvalLevel:
          user.approvalLevel,

        permissions:
          user.roleId?.permissions,

        active:
          user.isActive,
      });
    });

    console.log(
      "\n[ROLE FIX] Completed successfully."
    );
  } catch (error) {
    console.error(
      "[ROLE FIX] Failed:",
      error
    );

    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();

      console.log(
        "[ROLE FIX] MongoDB disconnected"
      );
    } catch (error) {
      console.error(
        "[ROLE FIX] Disconnect error:",
        error
      );
    }
  }
}

fixRoles();
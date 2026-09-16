const ApiError =
  require("../utils/ApiError");

const {
  allocateNextCode
} =
  require("./masterSequenceController");

// =====================================================
// GENERIC MASTER AUTO CODE CONFIG
//
// Company and Vendor have their own controllers.
//
// These generic masters use this factory.
// =====================================================
const AUTO_CODE_CONFIG = {
  Material: {
    master: "materials",
    field: "itemCode"
  },

  Project: {
    master: "projects",
    field: "projectCode"
  },

  CostCenter: {
    master: "cost-centers",
    field: "costCenterCode"
  },

  DeliveryAddress: {
    master: "delivery-addresses",
    field: "deliveryCode"
  },

  PaymentTerm: {
    master: "payment-terms",
    field: "paymentCode"
  },

  POTerm: {
    master: "po-terms",
    field: "termCode"
  }
};

// =====================================================
// ESCAPE SEARCH TEXT
// =====================================================
function escapeRegex(
  value
) {
  return String(
    value || ""
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

// =====================================================
// BUILD SEARCH
// =====================================================
function buildSearch(
  search,
  fields
) {
  if (
    !search ||
    !fields?.length
  ) {
    return {};
  }

  const regex =
    new RegExp(
      escapeRegex(
        search
      ),
      "i"
    );

  return {
    $or:
      fields.map(
        (
          field
        ) => ({
          [field]:
            regex
        })
      )
  };
}

// =====================================================
// RESOLVE AUTO CODE CONFIG
//
// Priority:
//
// 1. Explicit config passed from masterRoutes.js
// 2. Model name fallback
// =====================================================
function getAutoCodeConfig(
  Model,
  autoCodeMaster,
  autoCodeField
) {
  // ===================================================
  // EXPLICIT ROUTE CONFIG
  // ===================================================
  if (
    autoCodeMaster &&
    autoCodeField
  ) {
    return {
      master:
        autoCodeMaster,

      field:
        autoCodeField
    };
  }

  // ===================================================
  // FALLBACK USING MODEL NAME
  // ===================================================
  const modelName =
    String(
      Model?.modelName ||
      ""
    ).trim();

  return (
    AUTO_CODE_CONFIG[
      modelName
    ] ||
    null
  );
}

// =====================================================
// MASTER CONTROLLER FACTORY
// =====================================================
function factory(
  Model,
  {
    searchFields = [],

    sort = {
      createdAt: -1
    },

    autoCodeMaster =
      null,

    autoCodeField =
      null
  } = {}
) {
  // ===================================================
  // RESOLVE AUTO CODE ONCE
  // ===================================================
  const autoCode =
    getAutoCodeConfig(
      Model,
      autoCodeMaster,
      autoCodeField
    );

  return {
    // =================================================
    // LIST
    // =================================================
    list: async (
      req,
      res
    ) => {
      const page =
        Math.max(
          Number(
            req.query.page ||
            1
          ),
          1
        );

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit ||
              50
            ),
            1
          ),
          200
        );

      const filter = {
        ...buildSearch(
          req.query.search,
          searchFields
        )
      };

      // ===============================================
      // ACTIVE FILTER
      // ===============================================
      if (
        req.query.isActive !==
        undefined
      ) {
        filter.isActive =
          req.query.isActive ===
          "true";
      }

      // ===============================================
      // SCOPE FILTER
      // ===============================================
      if (
        req.query.scope
      ) {
        filter.scope =
          req.query.scope;
      }

      // ===============================================
      // CATEGORY FILTER
      // ===============================================
      if (
        req.query.category
      ) {
        filter.category =
          req.query.category;
      }

      // ===============================================
      // DATA + COUNT
      // ===============================================
      const [
        data,
        total
      ] =
        await Promise.all([
          Model.find(
            filter
          )
            .sort(
              sort
            )
            .skip(
              (
                page -
                1
              ) *
              limit
            )
            .limit(
              limit
            )
            .lean(),

          Model.countDocuments(
            filter
          )
        ]);

      return res.json({
        success:
          true,

        data,

        pagination: {
          page,

          limit,

          total,

          pages:
            Math.ceil(
              total /
              limit
            )
        }
      });
    },

    // =================================================
    // GET BY ID
    // =================================================
    getById: async (
      req,
      res
    ) => {
      const data =
        await Model.findById(
          req.params.id
        ).lean();

      if (
        !data
      ) {
        throw new ApiError(
          404,
          "Record not found"
        );
      }

      return res.json({
        success:
          true,

        data
      });
    },

    // =================================================
    // CREATE
    //
    // IMPORTANT FLOW:
    //
    // Open Add
    // -> frontend only previews code
    // -> no sequence increment
    //
    // Cancel
    // -> nothing
    //
    // Save
    // -> this create() runs
    // -> allocateNextCode()
    // -> sequence increments
    // -> backend code replaces preview code
    // -> record saved
    // =================================================
    create: async (
      req,
      res
    ) => {
      const payload = {
        ...req.body
      };

      // ===============================================
      // AUTO CODE
      // ===============================================
      if (
        autoCode
      ) {
        console.log(
          "[MASTER AUTO CODE]",
          {
            modelName:
              Model?.modelName,

            master:
              autoCode.master,

            field:
              autoCode.field
          }
        );

        const {
          code
        } =
          await allocateNextCode(
            autoCode.master
          );

        // =============================================
        // BACKEND CODE IS FINAL
        //
        // Never trust frontend preview code.
        // =============================================
        payload[
          autoCode.field
        ] =
          code;

        console.log(
          "[MASTER AUTO CODE ALLOCATED]",
          {
            master:
              autoCode.master,

            code
          }
        );
      }

      // ===============================================
      // CREATE RECORD
      // ===============================================
      const data =
        await Model.create(
          payload
        );

      return res
        .status(
          201
        )
        .json({
          success:
            true,

          data
        });
    },

    // =================================================
    // UPDATE
    //
    // Existing generated code must NEVER change.
    // =================================================
    update: async (
      req,
      res
    ) => {
      const payload = {
        ...req.body
      };

      // ===============================================
      // PRESERVE EXISTING GENERATED CODE
      // ===============================================
      if (
        autoCode
      ) {
        const existing =
          await Model.findById(
            req.params.id
          )
            .select(
              autoCode.field
            )
            .lean();

        if (
          !existing
        ) {
          throw new ApiError(
            404,
            "Record not found"
          );
        }

        payload[
          autoCode.field
        ] =
          existing[
            autoCode.field
          ];
      }

      // ===============================================
      // UPDATE RECORD
      // ===============================================
      const data =
        await Model.findByIdAndUpdate(
          req.params.id,

          payload,

          {
            new:
              true,

            runValidators:
              true
          }
        );

      if (
        !data
      ) {
        throw new ApiError(
          404,
          "Record not found"
        );
      }

      return res.json({
        success:
          true,

        data
      });
    },

    // =================================================
    // SET STATUS
    // =================================================
    setStatus: async (
      req,
      res
    ) => {
      if (
        typeof req.body
          ?.isActive !==
        "boolean"
      ) {
        throw new ApiError(
          400,
          "isActive boolean is required"
        );
      }

      const data =
        await Model.findByIdAndUpdate(
          req.params.id,

          {
            isActive:
              req.body.isActive
          },

          {
            new:
              true,

            runValidators:
              true
          }
        );

      if (
        !data
      ) {
        throw new ApiError(
          404,
          "Record not found"
        );
      }

      return res.json({
        success:
          true,

        data
      });
    }
  };
}

// =====================================================
// VERY IMPORTANT
//
// companyController.js uses:
//
// const factory = require("./masterControllerFactory");
//
// Therefore we MUST export the function directly.
// =====================================================
module.exports = factory;
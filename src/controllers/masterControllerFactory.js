const ApiError =
  require("../utils/ApiError");

const {
  allocateNextCode
} =
  require("./masterSequenceController");

// =====================================================
// GENERIC MASTER AUTO-CODE CONFIG
//
// Company and Vendor are NOT handled here because
// they have their own controllers.
//
// These masters use masterControllerFactory.
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
      String(
        search
      ).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
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
// GET AUTO CODE CONFIG
//
// Uses Mongoose model name.
//
// Examples:
//
// Material
// Project
// CostCenter
// DeliveryAddress
// PaymentTerm
// POTerm
//
// Role will return null because it has no generated code.
// =====================================================
function getAutoCodeConfig(
  Model
) {
  const modelName =
    Model?.modelName ||
    "";

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
    }
  } = {}
) {
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
      // FETCH DATA + COUNT
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
    // IMPORTANT AUTO CODE FLOW:
    //
    // Open form
    //     ↓
    // Frontend only previews MAT001 / PRJ01 etc.
    //     ↓
    // NO increment
    //
    // User clicks Cancel
    //     ↓
    // Nothing happens
    //
    // User clicks Save
    //     ↓
    // CREATE API reaches here
    //     ↓
    // allocateNextCode()
    //     ↓
    // Sequence increments
    //     ↓
    // Backend overwrites frontend preview code
    //     ↓
    // Record saved
    // =================================================
    create: async (
      req,
      res
    ) => {
      // ===============================================
      // COPY REQUEST BODY
      //
      // Do not directly modify req.body.
      // ===============================================
      const payload = {
        ...req.body
      };

      // ===============================================
      // CHECK WHETHER THIS MASTER HAS AUTO CODE
      // ===============================================
      const autoCode =
        getAutoCodeConfig(
          Model
        );

      if (
        autoCode
      ) {
        // =============================================
        // ACTUAL CODE ALLOCATION HAPPENS ONLY HERE
        //
        // This function performs the MongoDB $inc.
        // =============================================
        const {
          code
        } =
          await allocateNextCode(
            autoCode.master
          );

        // =============================================
        // IMPORTANT
        //
        // Always overwrite frontend preview.
        //
        // Never trust:
        //
        // req.body.itemCode
        // req.body.projectCode
        // etc.
        //
        // Backend sequence is final authority.
        // =============================================
        payload[
          autoCode.field
        ] =
          code;
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
    // IMPORTANT:
    //
    // No sequence generation here.
    //
    // Existing master code remains the same.
    // =================================================
    update: async (
      req,
      res
    ) => {
      const payload = {
        ...req.body
      };

      const autoCode =
        getAutoCodeConfig(
          Model
        );

      // ===============================================
      // PREVENT CHANGING AUTO-GENERATED CODE
      //
      // Fetch current record first and force its
      // existing code back into payload.
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
// EXPORT
// =====================================================
module.exports =
  factory;
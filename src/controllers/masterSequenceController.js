const MasterSequence =
  require("../models/MasterSequence");

const ApiError =
  require("../utils/ApiError");

// =====================================================
// ALLOWED MASTER CODE CONFIGURATION
//
// Change prefix here whenever required.
// =====================================================
const MASTER_CODE_CONFIG = {
  companies: {
    prefix: "CMP",
    digits: 2
  },

  vendors: {
    prefix: "TT",
    digits: 2
  },

  materials: {
    prefix: "MAT",
    digits: 3
  },

  projects: {
    prefix: "PRJ",
    digits: 2
  },

  "cost-centers": {
    prefix: "CC",
    digits: 2
  },

  "delivery-addresses": {
    prefix: "DEL",
    digits: 2
  },

  "payment-terms": {
    prefix: "PAY",
    digits: 2
  },

  "po-terms": {
    prefix: "TERM",
    digits: 2
  }
};

// =====================================================
// FORMAT CODE
// =====================================================
function formatCode(
  prefix,
  number,
  digits
) {
  return `${prefix}${String(
    number
  ).padStart(
    digits,
    "0"
  )}`;
}

// =====================================================
// RESERVE NEXT MASTER CODE
//
// MongoDB $inc is atomic.
//
// Example:
//
// vendors
// 0 -> 1
// returns TT01
//
// next call:
// 1 -> 2
// returns TT02
// =====================================================
exports.getNextCode =
  async (
    req,
    res
  ) => {
    const master =
      String(
        req.query.master ||
        ""
      )
        .trim()
        .toLowerCase();

    if (!master) {
      throw new ApiError(
        400,
        "master is required"
      );
    }

    const config =
      MASTER_CODE_CONFIG[
        master
      ];

    if (!config) {
      throw new ApiError(
        400,
        `Auto code is not configured for master: ${master}`
      );
    }

    // =================================================
    // ATOMIC INCREMENT
    // =================================================
    const sequence =
      await MasterSequence.findOneAndUpdate(
        {
          key:
            master
        },
        {
          $inc: {
            value:
              1
          }
        },
        {
          new:
            true,

          upsert:
            true,

          setDefaultsOnInsert:
            true
        }
      ).lean();

    const code =
      formatCode(
        config.prefix,
        sequence.value,
        config.digits
      );

    return res.json({
      success: true,

      data: {
        master,

        prefix:
          config.prefix,

        number:
          sequence.value,

        code
      }
    });
  };
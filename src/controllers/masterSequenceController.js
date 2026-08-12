const MasterSequence =
  require("../models/MasterSequence");

const ApiError =
  require("../utils/ApiError");

// =====================================================
// MASTER CODE CONFIGURATION
//
// model:
// Used only when sequence is being initialized for
// the first time.
//
// This allows us to continue from existing records.
//
// Example:
//
// Existing Vendor:
// TT1064
//
// First preview:
// TT1065
//
// NOT TT01
// =====================================================
const MASTER_CODE_CONFIG = {
  companies: {
    prefix: "CMP",
    digits: 2,
    field: "companyCode",
    getModel: () =>
      require("../models/Company")
  },

  vendors: {
    prefix: "TT",
    digits: 2,
    field: "vendorCode",
    getModel: () =>
      require("../models/Vendor")
  },

  materials: {
    prefix: "MAT",
    digits: 3,
    field: "itemCode",
    getModel: () =>
      require("../models/Material")
  },

  projects: {
    prefix: "PRJ",
    digits: 2,
    field: "projectCode",
    getModel: () =>
      require("../models/Project")
  },

  "cost-centers": {
    prefix: "CC",
    digits: 2,
    field: "costCenterCode",
    getModel: () =>
      require("../models/CostCenter")
  },

  "delivery-addresses": {
    prefix: "DEL",
    digits: 2,
    field: "deliveryCode",
    getModel: () =>
      require("../models/DeliveryAddress")
  },

  "payment-terms": {
    prefix: "PAY",
    digits: 2,
    field: "paymentCode",
    getModel: () =>
      require("../models/PaymentTerm")
  },

  "po-terms": {
    prefix: "TERM",
    digits: 2,
    field: "termCode",
    getModel: () =>
      require("../models/POTerm")
  }
};

// =====================================================
// FORMAT CODE
//
// Example:
//
// prefix = TT
// number = 1
// digits = 2
//
// returns:
//
// TT01
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
// ESCAPE REGEX
// =====================================================
function escapeRegex(
  value
) {
  return String(
    value
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

// =====================================================
// VALIDATE MASTER
// =====================================================
function getMasterConfig(
  master
) {
  const key =
    String(
      master ||
      ""
    )
      .trim()
      .toLowerCase();

  if (!key) {
    throw new ApiError(
      400,
      "master is required"
    );
  }

  const config =
    MASTER_CODE_CONFIG[
      key
    ];

  if (!config) {
    throw new ApiError(
      400,
      `Auto code is not configured for master: ${key}`
    );
  }

  return {
    master: key,
    config
  };
}

// =====================================================
// FIND HIGHEST EXISTING CODE
//
// IMPORTANT:
//
// This runs only when the sequence does not exist yet.
//
// Example existing vendors:
//
// TT01
// TT02
// TT1064
//
// max = 1064
//
// Sequence starts from:
//
// 1064
//
// Therefore preview:
//
// TT1065
// =====================================================
async function findExistingMaximum(
  config
) {
  const Model =
    config.getModel();

  const field =
    config.field;

  const prefix =
    config.prefix;

  // ===================================================
  // MATCH ONLY CODES WITH THIS PREFIX + NUMBER
  //
  // TT01
  // TT1064
  //
  // But NOT:
  //
  // TEST
  // ABC01
  // ===================================================
  const regex =
    new RegExp(
      `^${escapeRegex(
        prefix
      )}\\d+$`,
      "i"
    );

  const records =
    await Model.find({
      [field]: {
        $regex:
          regex
      }
    })
      .select({
        [field]: 1,
        _id: 0
      })
      .lean();

  let maximum =
    0;

  for (
    const record
    of records
  ) {
    const code =
      String(
        record?.[
          field
        ] ||
        ""
      )
        .trim()
        .toUpperCase();

    if (
      !code.startsWith(
        prefix.toUpperCase()
      )
    ) {
      continue;
    }

    const numericPart =
      code.substring(
        prefix.length
      );

    const number =
      Number(
        numericPart
      );

    if (
      Number.isInteger(
        number
      ) &&
      number >
        maximum
    ) {
      maximum =
        number;
    }
  }

  return maximum;
}

// =====================================================
// ENSURE SEQUENCE EXISTS
//
// IMPORTANT:
//
// This DOES NOT increment.
//
// It only creates the initial sequence document if
// the master has never used auto sequencing before.
//
// Existing records are checked first.
//
// Example:
//
// Existing vendor = TT1064
//
// Sequence collection does not exist.
//
// It creates:
//
// {
//   key: "vendors",
//   value: 1064
// }
//
// It DOES NOT create 1065 here.
// =====================================================
async function ensureSequence(
  master,
  config
) {
  // ===================================================
  // ALREADY INITIALIZED
  // ===================================================
  const existing =
    await MasterSequence.findOne({
      key:
        master
    }).lean();

  if (existing) {
    return existing;
  }

  // ===================================================
  // FIRST TIME INITIALIZATION
  // ===================================================
  const maximumExistingValue =
    await findExistingMaximum(
      config
    );

  try {
    const sequence =
      await MasterSequence.findOneAndUpdate(
        {
          key:
            master
        },

        {
          $setOnInsert: {
            key:
              master,

            value:
              maximumExistingValue
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

    return sequence;
  } catch (
    error
  ) {
    // =================================================
    // TWO USERS COULD INITIALIZE AT SAME TIME.
    //
    // UNIQUE KEY MAY CREATE DUPLICATE KEY RACE.
    //
    // If another request created it first,
    // simply read that existing sequence.
    // =================================================
    if (
      error?.code ===
      11000
    ) {
      const sequence =
        await MasterSequence.findOne({
          key:
            master
        }).lean();

      if (sequence) {
        return sequence;
      }
    }

    throw error;
  }
}

// =====================================================
// PREVIEW NEXT CODE
//
// IMPORTANT:
//
// NO DATABASE INCREMENT HERE.
//
// Example:
//
// Database:
//
// vendors value = 10
//
// Preview:
//
// TT11
//
// Database remains:
//
// vendors value = 10
//
// Therefore:
//
// Open form
// -> TT11
//
// Cancel
// -> value still 10
//
// Open again
// -> TT11 again
// =====================================================
async function previewNextCode(
  masterName
) {
  const {
    master,
    config
  } =
    getMasterConfig(
      masterName
    );

  const sequence =
    await ensureSequence(
      master,
      config
    );

  const currentNumber =
    Number(
      sequence?.value ||
      0
    );

  const nextNumber =
    currentNumber +
    1;

  const code =
    formatCode(
      config.prefix,
      nextNumber,
      config.digits
    );

  return {
    master,

    prefix:
      config.prefix,

    currentNumber,

    number:
      nextNumber,

    code
  };
}

// =====================================================
// GET NEXT CODE - PREVIEW ONLY
//
// FRONTEND CAN KEEP CALLING:
//
// GET
// /api/master-code/next?master=vendors
//
// IMPORTANT:
//
// THIS API NO LONGER INCREMENTS.
//
// Example:
//
// Current sequence = 0
//
// Open Add Vendor:
//
// GET /master-code/next?master=vendors
//
// returns:
//
// TT01
//
// database remains 0.
//
// Cancel form:
//
// database remains 0.
//
// Open again:
//
// still TT01.
// =====================================================
exports.getNextCode =
  async (
    req,
    res
  ) => {
    const result =
      await previewNextCode(
        req.query.master
      );

    return res.json({
      success:
        true,

      data:
        result
    });
  };

// =====================================================
// ALLOCATE NEXT CODE
//
// IMPORTANT:
//
// THIS IS THE FUNCTION THAT ACTUALLY INCREMENTS.
//
// CALL THIS ONLY WHEN USER CLICKS SAVE / CREATE.
//
// Example:
//
// const {
//   code
// } = await allocateNextCode("vendors");
//
// vendorData.vendorCode = code;
//
// await Vendor.create(vendorData);
//
// =====================================================
async function allocateNextCode(
  masterName
) {
  const {
    master,
    config
  } =
    getMasterConfig(
      masterName
    );

  // ===================================================
  // MAKE SURE INITIAL SEQUENCE EXISTS
  // ===================================================
  await ensureSequence(
    master,
    config
  );

  // ===================================================
  // ACTUAL ATOMIC INCREMENT
  //
  // THIS IS THE ONLY PLACE $inc OCCURS.
  // ===================================================
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
          true
      }
    ).lean();

  if (!sequence) {
    throw new ApiError(
      500,
      `Unable to generate code for master: ${master}`
    );
  }

  const code =
    formatCode(
      config.prefix,
      sequence.value,
      config.digits
    );

  return {
    master,

    prefix:
      config.prefix,

    number:
      sequence.value,

    code
  };
}

// =====================================================
// EXPORT ALLOCATION FUNCTION
//
// Controllers will import:
//
// const {
//   allocateNextCode
// } = require("./masterSequenceController");
//
// and call it ONLY during CREATE.
// =====================================================
exports.allocateNextCode =
  allocateNextCode;

// =====================================================
// OPTIONAL EXPORT PREVIEW
// =====================================================
exports.previewNextCode =
  previewNextCode;
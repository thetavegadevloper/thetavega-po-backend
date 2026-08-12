const Company = require("../models/Company");
const factory = require("./masterControllerFactory");
const ApiError = require("../utils/ApiError");

const {
  allocateNextCode
} = require("./masterSequenceController");

const {
  State,
  City
} = require("country-state-city");

// =====================================================
// NORMAL COMPANY CRUD
// =====================================================
const baseController = factory(
  Company,
  {
    searchFields: [
      "companyName",
      "companyCode",
      "gstin"
    ]
  }
);

// =====================================================
// GST / STATE MASTER
// =====================================================
const GST_STATE_CODES = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory"
};

// =====================================================
// NORMALIZE GSTIN
// =====================================================
function normalizeGSTIN(value) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

// =====================================================
// NORMALIZE LOCATION NAME
// =====================================================
function normalizeLocationName(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");
}

// =====================================================
// GET GST STATE CODE FROM STATE NAME
// =====================================================
function getStateCodeFromName(
  stateName
) {
  const normalized =
    normalizeLocationName(
      stateName
    );

  const match =
    Object.entries(
      GST_STATE_CODES
    ).find(
      ([
        _code,
        name
      ]) =>
        normalizeLocationName(
          name
        ) ===
        normalized
    );

  return (
    match?.[0] ||
    ""
  );
}

// =====================================================
// GET COUNTRY-STATE-CITY STATE RECORD
// =====================================================
function getIndiaState(
  stateName
) {
  const normalized =
    normalizeLocationName(
      stateName
    );

  const states =
    State.getStatesOfCountry(
      "IN"
    );

  return states.find(
    (state) =>
      normalizeLocationName(
        state.name
      ) ===
      normalized
  );
}

// =====================================================
// GSTIN FORMAT VALIDATION
// =====================================================
function validateGSTIN(
  gstin
) {
  const value =
    normalizeGSTIN(
      gstin
    );

  const pattern =
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

  return pattern.test(
    value
  );
}

// =====================================================
// PARSE GSTIN
// =====================================================
function parseGSTIN(
  gstin
) {
  const value =
    normalizeGSTIN(
      gstin
    );

  if (
    !validateGSTIN(
      value
    )
  ) {
    throw new ApiError(
      400,
      "Invalid GSTIN format"
    );
  }

  const stateCode =
    value.substring(
      0,
      2
    );

  const pan =
    value.substring(
      2,
      12
    );

  const gstState =
    GST_STATE_CODES[
      stateCode
    ];

  if (!gstState) {
    throw new ApiError(
      400,
      `Invalid GST State Code: ${stateCode}`
    );
  }

  return {
    gstin:
      value,

    pan,

    stateCode,

    gstState
  };
}

// =====================================================
// GST LOOKUP
//
// GSTIN
// -> PAN
// -> GST State Code
// -> GST State
// =====================================================
exports.lookupGST =
  async (
    req,
    res
  ) => {
    const gstin =
      normalizeGSTIN(
        req.params.gstin
      );

    const parsed =
      parseGSTIN(
        gstin
      );

    return res.json({
      success: true,

      data: {
        gstin:
          parsed.gstin,

        pan:
          parsed.pan,

        stateCode:
          parsed.stateCode,

        gstState:
          parsed.gstState,

        verified:
          false,

        verificationSource:
          "LOCAL_GST_VALIDATION"
      }
    });
  };

// =====================================================
// GET CITIES BY STATE
//
// FLOW:
//
// State
//   ↓
// City Dropdown
//
// Example:
//
// GET
// /api/companies/location/cities?state=Maharashtra
// =====================================================
exports.getCities =
  async (
    req,
    res
  ) => {
    const stateName =
      String(
        req.query.state ||
        ""
      ).trim();

    if (!stateName) {
      throw new ApiError(
        400,
        "State is required"
      );
    }

    const state =
      getIndiaState(
        stateName
      );

    if (!state) {
      throw new ApiError(
        404,
        `State not found: ${stateName}`
      );
    }

    const rawCities =
      City.getCitiesOfState(
        "IN",
        state.isoCode
      );

    const seen =
      new Set();

    const cities =
      [];

    rawCities
      .sort(
        (a, b) =>
          String(
            a.name
          ).localeCompare(
            String(
              b.name
            )
          )
      )
      .forEach(
        (city) => {
          const name =
            String(
              city.name ||
              ""
            ).trim();

          if (!name) {
            return;
          }

          const key =
            name.toLowerCase();

          if (
            seen.has(
              key
            )
          ) {
            return;
          }

          seen.add(
            key
          );

          cities.push({
            name,

            state:
              state.name,

            stateIsoCode:
              state.isoCode,

            gstStateCode:
              getStateCodeFromName(
                state.name
              ),

            latitude:
              city.latitude ||
              "",

            longitude:
              city.longitude ||
              ""
          });
        }
      );

    return res.json({
      success: true,

      data: {
        state:
          state.name,

        stateIsoCode:
          state.isoCode,

        gstStateCode:
          getStateCodeFromName(
            state.name
          ),

        cities
      }
    });
  };

// =====================================================
// GET AREAS / POST OFFICES BY CITY
//
// FLOW:
//
// State
//   ↓
// City
//   ↓
// Area / Post Office
//   ↓
// Pincode
// District
// State Code
// Country
//
// Example:
//
// GET
// /api/companies/location/areas
// ?state=Maharashtra
// &city=Pune
// =====================================================
exports.getAreas =
  async (
    req,
    res
  ) => {
    const state =
      String(
        req.query.state ||
        ""
      ).trim();

    const city =
      String(
        req.query.city ||
        ""
      ).trim();

    if (!state) {
      throw new ApiError(
        400,
        "State is required"
      );
    }

    if (!city) {
      throw new ApiError(
        400,
        "City is required"
      );
    }

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        10000
      );

    try {
      const response =
        await fetch(
          `https://api.postalpincode.in/postoffice/${encodeURIComponent(
            city
          )}`,
          {
            method:
              "GET",

            headers: {
              Accept:
                "application/json"
            },

            signal:
              controller.signal
          }
        );

      if (
        !response.ok
      ) {
        throw new ApiError(
          502,
          "Unable to fetch postal location details"
        );
      }

      const result =
        await response.json();

      const payload =
        Array.isArray(
          result
        )
          ? result[0]
          : null;

      if (
        !payload ||
        payload.Status !==
          "Success" ||
        !Array.isArray(
          payload.PostOffice
        )
      ) {
        throw new ApiError(
          404,
          `No postal locations found for ${city}`
        );
      }

      const normalizedState =
        normalizeLocationName(
          state
        );

      const filtered =
        payload.PostOffice.filter(
          (office) =>
            normalizeLocationName(
              office.State
            ) ===
            normalizedState
        );

      const seen =
        new Set();

      const areas =
        [];

      filtered.forEach(
        (office) => {
          const areaName =
            String(
              office.Name ||
              ""
            ).trim();

          const pincode =
            String(
              office.Pincode ||
              ""
            ).trim();

          const district =
            String(
              office.District ||
              ""
            ).trim();

          const key =
            `${areaName}|${pincode}|${district}`;

          if (
            seen.has(
              key
            )
          ) {
            return;
          }

          seen.add(
            key
          );

          areas.push({
            areaName,

            city,

            district,

            state:
              office.State ||
              state,

            stateCode:
              getStateCodeFromName(
                office.State ||
                state
              ),

            pincode,

            country:
              office.Country ||
              "India",

            branchType:
              office.BranchType ||
              "",

            deliveryStatus:
              office.DeliveryStatus ||
              "",

            circle:
              office.Circle ||
              "",

            division:
              office.Division ||
              "",

            region:
              office.Region ||
              ""
          });
        }
      );

      if (
        !areas.length
      ) {
        throw new ApiError(
          404,
          `No postal areas found for ${city}, ${state}`
        );
      }

      areas.sort(
        (a, b) =>
          a.areaName.localeCompare(
            b.areaName
          )
      );

      return res.json({
        success: true,

        data: {
          state,

          city,

          areas
        }
      });
    } catch (
      error
    ) {
      if (
        error.name ===
        "AbortError"
      ) {
        throw new ApiError(
          504,
          "Postal location service timed out"
        );
      }

      if (
        error instanceof
        ApiError
      ) {
        throw error;
      }

      console.error(
        "[COMPANY AREA LOOKUP]",
        error
      );

      throw new ApiError(
        502,
        "Unable to fetch postal area details"
      );
    } finally {
      clearTimeout(
        timeout
      );
    }
  };

// =====================================================
// CREATE COMPANY
//
// IMPORTANT AUTO CODE FLOW:
//
// Open Add Company
//     ↓
// Frontend only previews CMP01
//     ↓
// NO sequence increment
//
// Cancel
//     ↓
// Nothing happens
//
// Click Save
//     ↓
// This CREATE function runs
//     ↓
// GST validated first
//     ↓
// allocateNextCode("companies")
//     ↓
// sequence increments
//     ↓
// actual Company Code assigned
//     ↓
// Company saved
//
// Frontend companyCode is NEVER trusted.
// =====================================================
exports.create =
  async (
    req,
    res
  ) => {
    const body = {
      ...req.body
    };

    // =================================================
    // FIRST VALIDATE / NORMALIZE GST
    //
    // Do this before allocating code so an invalid
    // GST does not consume a sequence number.
    // =================================================
    if (
      body.gstin
    ) {
      const gst =
        parseGSTIN(
          body.gstin
        );

      body.gstin =
        gst.gstin;

      body.pan =
        gst.pan;

      body.stateCode =
        gst.stateCode;

      body.gstState =
        gst.gstState;
    }

    // =================================================
    // ACTUAL COMPANY CODE ALLOCATION
    //
    // This is the point where sequence increments.
    // =================================================
    const {
      code
    } =
      await allocateNextCode(
        "companies"
      );

    // =================================================
    // BACKEND CODE IS FINAL AUTHORITY
    //
    // Example:
    //
    // Frontend preview = CMP05
    //
    // If another user already saved CMP05,
    // backend may now allocate CMP06.
    //
    // Therefore always overwrite frontend value.
    // =================================================
    body.companyCode =
      code;

    // =================================================
    // PASS FINAL BODY TO EXISTING CREATE
    // =================================================
    req.body =
      body;

    return baseController.create(
      req,
      res
    );
  };

// =====================================================
// UPDATE COMPANY
//
// IMPORTANT:
//
// Company Code must NEVER be regenerated or changed.
//
// Existing:
//
// CMP05
//
// Edit Company
// -> remains CMP05
//
// Even if frontend sends:
//
// CMP999
//
// backend restores:
// CMP05
// =====================================================
exports.update =
  async (
    req,
    res
  ) => {
    // =================================================
    // FIND EXISTING COMPANY FIRST
    // =================================================
    const existingCompany =
      await Company.findById(
        req.params.id
      )
        .select(
          "companyCode"
        )
        .lean();

    if (
      !existingCompany
    ) {
      throw new ApiError(
        404,
        "Record not found"
      );
    }

    const body = {
      ...req.body
    };

    // =================================================
    // KEEP EXISTING COMPANY CODE
    // =================================================
    body.companyCode =
      existingCompany.companyCode;

    // =================================================
    // GST NORMALIZATION
    // =================================================
    if (
      body.gstin
    ) {
      const gst =
        parseGSTIN(
          body.gstin
        );

      body.gstin =
        gst.gstin;

      body.pan =
        gst.pan;

      body.stateCode =
        gst.stateCode;

      body.gstState =
        gst.gstState;
    }

    req.body =
      body;

    return baseController.update(
      req,
      res
    );
  };

// =====================================================
// NORMAL CRUD
// =====================================================
exports.list =
  baseController.list;

exports.getById =
  baseController.getById;

exports.setStatus =
  baseController.setStatus;
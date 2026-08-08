const PaymentTerm = require("../models/PaymentTerm");

// =====================================================
// GET PAYMENT TERMS
// =====================================================
exports.getPaymentTerms = async (req, res) => {
  try {
    const {
      search = "",
      isActive,
      page = 1,
      limit = 100
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        {
          paymentCode: {
            $regex: search,
            $options: "i"
          }
        },
        {
          paymentName: {
            $regex: search,
            $options: "i"
          }
        },
        {
          paymentSummary: {
            $regex: search,
            $options: "i"
          }
        }
      ];
    }

    if (isActive !== undefined && isActive !== "") {
      filter.isActive =
        String(isActive) === "true";
    }

    const pageNumber =
      Math.max(Number(page) || 1, 1);

    const pageSize =
      Math.min(Number(limit) || 100, 200);

    const [data, total] = await Promise.all([
      PaymentTerm.find(filter)
        .sort({
          displayOrder: 1,
          paymentCode: 1
        })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),

      PaymentTerm.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error("Get Payment Terms Error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch payment terms"
    });
  }
};

// =====================================================
// CREATE PAYMENT TERM
// =====================================================
exports.createPaymentTerm = async (req, res) => {
  try {
    const {
      paymentCode,
      paymentName,
      paymentSummary,
      description,
      displayOrder,
      isActive
    } = req.body;

    if (
      !paymentCode ||
      !paymentName ||
      !paymentSummary
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment Code, Payment Name and Payment Summary are required"
      });
    }

    const existing =
      await PaymentTerm.findOne({
        paymentCode:
          paymentCode.trim().toUpperCase()
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Payment Code already exists"
      });
    }

    const paymentTerm =
      await PaymentTerm.create({
        paymentCode:
          paymentCode.trim().toUpperCase(),

        paymentName:
          paymentName.trim(),

        paymentSummary:
          paymentSummary.trim(),

        description:
          description?.trim() || "",

        displayOrder:
          Number(displayOrder || 1),

        isActive:
          typeof isActive === "boolean"
            ? isActive
            : true
      });

    return res.status(201).json({
      success: true,
      message:
        "Payment term created successfully",
      data: paymentTerm
    });
  } catch (error) {
    console.error(
      "Create Payment Term Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create payment term"
    });
  }
};

// =====================================================
// UPDATE PAYMENT TERM
// =====================================================
exports.updatePaymentTerm = async (req, res) => {
  try {
    const paymentTerm =
      await PaymentTerm.findById(
        req.params.id
      );

    if (!paymentTerm) {
      return res.status(404).json({
        success: false,
        message: "Payment term not found"
      });
    }

    const {
      paymentCode,
      paymentName,
      paymentSummary,
      description,
      displayOrder,
      isActive
    } = req.body;

    if (paymentCode !== undefined) {
      paymentTerm.paymentCode =
        paymentCode.trim().toUpperCase();
    }

    if (paymentName !== undefined) {
      paymentTerm.paymentName =
        paymentName.trim();
    }

    if (paymentSummary !== undefined) {
      paymentTerm.paymentSummary =
        paymentSummary.trim();
    }

    if (description !== undefined) {
      paymentTerm.description =
        description?.trim() || "";
    }

    if (displayOrder !== undefined) {
      paymentTerm.displayOrder =
        Number(displayOrder || 1);
    }

    if (isActive !== undefined) {
      paymentTerm.isActive =
        Boolean(isActive);
    }

    await paymentTerm.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment term updated successfully",
      data: paymentTerm
    });
  } catch (error) {
    console.error(
      "Update Payment Term Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update payment term"
    });
  }
};
const { body } = require("express-validator");
const { normalizeProduceName } = require("../utils/produce");

exports.salesValidation = [
  body("produceName")
    .trim()
    .notEmpty()
    .withMessage("Name of produce is required")
    .customSanitizer((value) => normalizeProduceName(value))
    .notEmpty()
    .withMessage("Use only valid produce items: Beans, Grain Maize, Cow peas, G-nuts, Soybeans"),
  body("tonnageKgs")
    .notEmpty()
    .withMessage("Tonnage in KGs is required")
    .isInt({ min: 1 })
    .withMessage("Tonnage in KGs must be at least 1"),
  body("amountPaidUgx")
    .notEmpty()
    .withMessage("Amount paid (UGX) is required")
    .isFloat({ min: 10000 })
    .withMessage("Amount paid (UGX) must be at least 10,000"),
  body("buyerName")
    .trim()
    .notEmpty()
    .withMessage("Buyer name is required")
    .matches(/^[A-Za-z0-9 ]{2,}$/)
    .withMessage("Buyer name must be at least 2 alphanumeric characters"),
  body("salesAgentName")
    .trim()
    .notEmpty()
    .withMessage("Seller name is required")
    .matches(/^[A-Za-z0-9 ]{2,}$/)
    .withMessage("Seller name must be at least 2 alphanumeric characters"),
  body("branchName")
    .trim()
    .notEmpty()
    .withMessage("Branch name is required")
    .toLowerCase()
    .isIn(["maganjo", "matugga"])
    .withMessage("Branch must be maganjo or matugga"),
  body("saleDate").optional().isISO8601().withMessage("Date must be valid"),
  body("saleTime").optional().notEmpty().withMessage("Time is required")
];

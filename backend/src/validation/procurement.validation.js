const { body } = require("express-validator");
const { normalizeProduceName } = require("../utils/produce");

exports.procurementValidation = [
  body("produceName")
    .trim()
    .notEmpty()
    .withMessage("Name of produce is required")
    .customSanitizer((value) => normalizeProduceName(value))
    .notEmpty()
    .withMessage("Use only valid produce items: Beans, Grain Maize, Cow peas, G-nuts, Soybeans"),
  body("produceType")
    .trim()
    .notEmpty()
    .withMessage("Type of produce is required")
    .matches(/^[A-Za-z ]{2,}$/)
    .withMessage("Type of produce must contain only letters and be at least 2 characters"),
  body("tonnageKgs")
    .notEmpty()
    .withMessage("Tonnage in KGs is required")
    .isInt({ min: 1000 })
    .withMessage("Tonnage in KGs must be at least 1000"),
  body("costUgx")
    .notEmpty()
    .withMessage("Cost in UGX is required")
    .isFloat({ min: 10000 })
    .withMessage("Cost in UGX must be at least 10,000"),
  body("dealerName")
    .trim()
    .notEmpty()
    .withMessage("Name of dealer is required")
    .matches(/^[A-Za-z0-9 ]{2,}$/)
    .withMessage("Name of dealer must be at least 2 alphanumeric characters"),
  body("dealerContact")
    .trim()
    .notEmpty()
    .withMessage("Dealer contact (valid phone number) is required")
    .matches(/^(\+256|0)7\d{8}$/)
    .withMessage("Dealer contact (valid phone number) must be a valid Ugandan phone number"),
  body("sellingPriceUgx")
    .notEmpty()
    .withMessage("Price to be sold at (UGX) is required")
    .isFloat({ min: 10000 })
    .withMessage("Price to be sold at (UGX) must be at least 10,000"),
  body("branchName")
    .trim()
    .notEmpty()
    .withMessage("Branch name (Auto) is required")
    .toLowerCase()
    .isIn(["maganjo", "matugga"])
    .withMessage("Branch name (Auto) must be maganjo or matugga")
];

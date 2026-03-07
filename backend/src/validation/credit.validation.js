const { body } = require("express-validator");
const { normalizeProduceName } = require("../utils/produce");

const sharedCreditValidation = [
  body("buyerName")
    .trim()
    .notEmpty()
    .withMessage("Buyer name is required")
    .matches(/^[A-Za-z0-9 ]{2,}$/)
    .withMessage("Buyer name must be at least 2 alphanumeric characters"),
  body("nationalId")
    .trim()
    .notEmpty()
    .withMessage("National ID (NIN) is required")
    .matches(/^[A-Z]{2}[0-9]{12}[A-Z]$/)
    .withMessage("NIN must follow format: 2 letters + 12 digits + 1 letter"),
  body("location")
    .trim()
    .notEmpty()
    .withMessage("Location is required")
    .matches(/^[A-Za-z0-9 ]{2,}$/)
    .withMessage("Location must be at least 2 alphanumeric characters"),
  body("contact")
    .trim()
    .notEmpty()
    .withMessage("Contact (valid phone number) is required")
    .matches(/^(\+256|0)7\d{8}$/)
    .withMessage("Contact must be a valid Ugandan phone number"),
  body("salesAgentName")
    .trim()
    .notEmpty()
    .withMessage("Seller name is required")
    .matches(/^[A-Za-z0-9 ]{2,}$/)
    .withMessage("Seller name must be at least 2 alphanumeric characters"),
  body("dueDate").isISO8601().withMessage("Due date must be valid"),
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
    .withMessage("Produce type must contain only letters and be at least 2 characters"),
  body("tonnageKgs")
    .notEmpty()
    .withMessage("Tonnage in KGs is required")
    .isInt({ min: 1 })
    .withMessage("Tonnage in KGs must be at least 1"),
  body("dispatchDate").isISO8601().withMessage("Dispatch date must be valid"),
  body("branchName")
    .trim()
    .notEmpty()
    .withMessage("Branch name is required")
    .toLowerCase()
    .isIn(["maganjo", "matugga"])
    .withMessage("Branch must be maganjo or matugga")
];

exports.createCreditValidation = [
  body("amountDueUgx")
    .notEmpty()
    .withMessage("Amount due (UGX) is required")
    .isFloat({ min: 10000 })
    .withMessage("Amount due (UGX) must be at least 10,000"),
  ...sharedCreditValidation
];

exports.updateCreditValidation = [
  body("amountDueUgx")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount due (UGX) must be a non-negative number"),
  ...sharedCreditValidation
];

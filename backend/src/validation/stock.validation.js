const { body } = require("express-validator");
const { normalizeProduceName } = require("../utils/produce");

exports.stockValidation = [
  body("produceName")
    .notEmpty()
    .withMessage("Item name is required")
    .customSanitizer((value) => normalizeProduceName(value))
    .notEmpty()
    .withMessage("Use only valid produce items: Beans, Grain Maize, Cow peas, G-nuts, Soybeans"),
  body("type").optional().trim().isLength({ min: 2 }).withMessage("Type must be at least 2 characters"),
  body("unit").notEmpty().withMessage("Unit is required").trim(),
  body("tonnageKgs").isInt({ min: 0 }).withMessage("Quantity must be 0 or greater"),
  body("sellingPrice").optional().isFloat({ min: 0 }).withMessage("Selling price must be non-negative"),
  body("branchName")
    .notEmpty()
    .withMessage("Branch is required")
    .trim()
    .toLowerCase()
    .isIn(["maganjo", "matugga"])
    .withMessage("Branch must be maganjo or matugga"),
  body("updatedAt").optional().isISO8601().withMessage("updatedAt must be a valid date")
];

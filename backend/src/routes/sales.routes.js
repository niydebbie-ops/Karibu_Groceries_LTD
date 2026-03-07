const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { salesValidation } = require("../validation/sales.validation");
const { validationResult } = require("express-validator");
const { createSale, getSales, updateSale, deleteSale, getUnitPrice } = require("../controllers/sales.controller");

router.use(protect, authorize("Manager", "SalesAgent"));

function normalizeSalesPayload(req, res, next) {
  const b = req.body || {};
  req.body = {
    ...b,
    produceName: b.produceName ?? b.itemName ?? "",
    tonnageKgs: b.tonnageKgs ?? b.tonnage ?? "",
    amountPaidUgx: b.amountPaidUgx ?? b.amountPaid ?? "",
    salesAgentName: b.salesAgentName ?? b.agentName ?? b.sellerName ?? "",
    branchName: (req.user?.branch || b.branchName || b.branch || "").toString().trim().toLowerCase(),
    saleDate: b.saleDate ?? b.date ?? new Date().toISOString(),
    saleTime: b.saleTime ?? b.time ?? new Date().toLocaleTimeString()
  };
  next();
}

// CREATE
router.post("/", normalizeSalesPayload, salesValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}, createSale);

// READ
router.get("/", getSales);
router.get("/unit-price", getUnitPrice);

// UPDATE
router.put("/:id", normalizeSalesPayload, salesValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}, updateSale);

// DELETE
router.delete("/:id", deleteSale);

module.exports = router;

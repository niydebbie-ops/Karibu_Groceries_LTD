const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { procurementValidation } = require("../validation/procurement.validation");
const { validationResult } = require("express-validator");
const {
  createProcurement,
  getProcurements,
  updateProcurement,
  deleteProcurement
} = require("../controllers/procurement.controller");

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

// Backward compatibility: map legacy keys to current teacher-aligned keys
function normalizeProcurementPayload(req, res, next) {
  const b = req.body || {};
  req.body = {
    ...b,
    produceName: b.produceName ?? b.itemName ?? "",
    produceType: b.produceType ?? b.type ?? b.category ?? "",
    tonnageKgs: b.tonnageKgs ?? b.tonnage ?? b.quantity ?? "",
    costUgx: b.costUgx ?? b.cost ?? "",
    sellingPriceUgx: b.sellingPriceUgx ?? b.sellingPrice ?? "",
    dealerName: b.dealerName ?? "",
    dealerContact: b.dealerContact ?? "",
    procurementDate: b.procurementDate ?? b.date ?? new Date().toISOString(),
    procurementTime: b.procurementTime ?? b.time ?? new Date().toLocaleTimeString(),
    branchName: b.branchName ?? b.branch ?? ""
  };
  next();
}

router.use(protect, authorize("Manager"));

router.post("/", normalizeProcurementPayload, procurementValidation, handleValidationErrors, createProcurement);
router.get("/", getProcurements);
router.put("/:id", normalizeProcurementPayload, procurementValidation, handleValidationErrors, updateProcurement);
router.delete("/:id", deleteProcurement);

module.exports = router;

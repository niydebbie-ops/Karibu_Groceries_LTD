const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { createCreditValidation, updateCreditValidation } = require("../validation/credit.validation");
const { validationResult } = require("express-validator");
const { createCredit, getCredits, updateCredit, deleteCredit, payCredit } = require("../controllers/credit.controller");

router.use(protect, authorize("Manager", "SalesAgent"));

function normalizeCreditPayload(req, res, next) {
  const b = req.body || {};
  req.body = {
    ...b,
    nationalId: b.nationalId ?? b.nin ?? "",
    amountDueUgx: b.amountDueUgx ?? b.amountDue ?? "",
    produceName: b.produceName ?? b.itemName ?? "",
    produceType: b.produceType ?? b.type ?? "",
    salesAgentName: b.salesAgentName ?? b.agentName ?? b.sellerName ?? "",
    tonnageKgs: b.tonnageKgs ?? b.tonnage ?? "",
    branchName: (req.user?.branch || b.branchName || b.branch || "").toString().trim().toLowerCase(),
    dispatchDate: b.dispatchDate || new Date().toISOString()
  };
  next();
}

// CREATE
router.post("/", normalizeCreditPayload, createCreditValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}, createCredit);

// READ
router.get("/", getCredits);

// UPDATE
router.put("/:id", normalizeCreditPayload, updateCreditValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}, updateCredit);

// DELETE
router.delete("/:id", deleteCredit);
router.post("/:id/pay", payCredit);

module.exports = router;

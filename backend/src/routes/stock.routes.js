const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { stockValidation } = require("../validation/stock.validation");
const { validationResult } = require("express-validator");
const { createStock, getStocks, updateStock, deleteStock } = require("../controllers/stock.controller");

router.use(protect);

function normalizeStockPayload(req, res, next) {
  const b = req.body || {};
  req.body = {
    ...b,
    produceName: b.produceName ?? b.itemName ?? "",
    tonnageKgs: b.tonnageKgs ?? b.quantity ?? "",
    branchName: b.branchName ?? b.branch ?? "",
    updatedAt: b.updatedAt ?? b.lastUpdated
  };
  next();
}

// CREATE
router.post("/", authorize("Manager"), normalizeStockPayload, stockValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}, createStock);

// READ
router.get("/", authorize("Manager", "SalesAgent"), getStocks);

// UPDATE
router.put("/:id", authorize("Manager"), normalizeStockPayload, stockValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}, updateStock);

// DELETE
router.delete("/:id", authorize("Manager"), deleteStock);

module.exports = router;

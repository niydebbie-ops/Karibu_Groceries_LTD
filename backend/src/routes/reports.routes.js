const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { getSummary, getReports, getBranchOverview } = require("../controllers/reports.controller");

// Summary cards
router.get("/summary", auth, authorize("Director"), getSummary);

// Reports table
router.get("/", auth, authorize("Director"), getReports);

// Manager/SalesAgent dashboard overview (role-aware fields)
router.get("/branch-overview", auth, authorize("Manager", "SalesAgent"), getBranchOverview);

module.exports = router;

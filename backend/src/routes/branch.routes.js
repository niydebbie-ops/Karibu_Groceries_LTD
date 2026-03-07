const express = require("express");
const {
  createBranch,
  getBranches,
  updateBranch,
  deleteBranch,
  assignUserToBranch,
  setBranchActive
} = require("../controllers/branch.controller");
const protect = require("../middleware/auth");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(protect, authorize("Director"));

router.post("/", createBranch);
router.get("/", getBranches);
router.put("/:id", updateBranch);
router.patch("/:id/active", setBranchActive);
router.delete("/:id", deleteBranch);

router.post("/assign", assignUserToBranch);

module.exports = router;

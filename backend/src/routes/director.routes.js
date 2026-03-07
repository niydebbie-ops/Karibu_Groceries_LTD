const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  setUserActive
} = require("../controllers/director.controller");

const router = express.Router();

router.use(protect, authorize("Director"));

router.get("/users", getUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.patch("/users/:id/active", setUserActive);
router.delete("/users/:id", deleteUser);

module.exports = router;

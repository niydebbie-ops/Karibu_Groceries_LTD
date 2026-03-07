const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/auth.controller");
const { body, validationResult } = require("express-validator");

// Validation rules
const validateRegister = [
  body("fullName")
    .customSanitizer((value, { req }) => value ?? req.body?.name)
    .notEmpty()
    .withMessage("Full name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("role")
    .isIn(["Manager", "SalesAgent", "Director"])
    .withMessage("Role must be Manager, SalesAgent, or Director")
];

const validateLogin = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required")
];

// Handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: errors.array() });
  }
  next();
};

// Public routes
router.post("/register", validateRegister, handleValidation, register);
router.post("/login", validateLogin, handleValidation, login);

module.exports = router;

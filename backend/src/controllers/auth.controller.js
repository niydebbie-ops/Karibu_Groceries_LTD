const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Branch = require("../models/Branch");

function signToken(userId) {
  return jwt.sign(
    { id: String(userId) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "30d" }
  );
}

async function findUserBranch(userId) {
  const branch = await Branch.findOne({
    users: userId,
    isActive: true
  }).select("name");

  return branch?.name || "";
}

exports.register = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName ?? req.body?.name ?? "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "").trim();

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const user = await User.create({ fullName, email, password, role });
    const token = signToken(user._id);
    const branch = await findUserBranch(user._id);

    return res.status(201).json({
      success: true,
      token,
      data: {
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branch
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Registration failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = signToken(user._id);
    const branch = await findUserBranch(user._id);

    if (user.role !== "Director" && !branch) {
      return res.status(403).json({
        success: false,
        message: "No active branch assigned to this account"
      });
    }

    return res.json({
      success: true,
      token,
      data: {
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branch
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Login failed" });
  }
};

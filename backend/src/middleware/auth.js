const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Branch = require("../models/Branch");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized: missing token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id fullName email role isActive");

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized: user not found" });
    }
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const branch = await Branch.findOne({ users: user._id, isActive: true }).select("name");
    req.user = {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      branch: branch?.name || ""
    };

    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized: invalid token" });
  }
};

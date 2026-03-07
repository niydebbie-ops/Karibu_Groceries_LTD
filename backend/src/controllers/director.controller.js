const User = require("../models/User");
const Branch = require("../models/Branch");

async function getBranchMap() {
  const branches = await Branch.find().select("name users");
  const byUserId = new Map();
  branches.forEach((b) => {
    (b.users || []).forEach((u) => {
      byUserId.set(String(u), b.name);
    });
  });
  return byUserId;
}

exports.getUsers = async (req, res) => {
  try {
    const [users, byUserId] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      getBranchMap()
    ]);

    const mapped = users.map((u) => ({
      _id: u._id,
      fullName: u.fullName,
      name: u.fullName,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      branch: byUserId.get(String(u._id)) || ""
    }));

    return res.json({ success: true, data: mapped });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch users" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const payload = {
      fullName: String(req.body?.fullName || req.body?.name || "").trim(),
      email: String(req.body?.email || "").trim().toLowerCase(),
      password: String(req.body?.password || ""),
      role: String(req.body?.role || "").trim()
    };
    const existing = await User.findOne({ email: payload.email });
    if (existing) return res.status(409).json({ success: false, message: "Email already exists" });

    const created = await User.create(payload);
    return res.status(201).json({
      success: true,
      data: {
        _id: created._id,
        fullName: created.fullName,
        email: created.email,
        role: created.role,
        isActive: created.isActive
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to create user" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (req.body?.fullName || req.body?.name) {
      user.fullName = String(req.body.fullName || req.body.name).trim();
    }
    if (req.body?.email) user.email = String(req.body.email).trim().toLowerCase();
    if (req.body?.role) user.role = String(req.body.role).trim();
    if (req.body?.password) user.password = String(req.body.password);

    await user.save();
    return res.json({
      success: true,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update user" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.role === "Director") {
      const directorCount = await User.countDocuments({ role: "Director" });
      if (directorCount <= 1) {
        return res.status(400).json({ success: false, message: "Cannot delete the last director account" });
      }
    }
    await Branch.updateMany({ users: user._id }, { $pull: { users: user._id } });
    await user.deleteOne();
    return res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete user" });
  }
};

exports.setUserActive = async (req, res) => {
  try {
    const isActive = Boolean(req.body?.isActive);
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.role === "Director" && !isActive) {
      const activeDirectors = await User.countDocuments({ role: "Director", isActive: true });
      if (activeDirectors <= 1) {
        return res.status(400).json({ success: false, message: "Cannot deactivate the last active director" });
      }
    }
    user.isActive = isActive;
    await user.save();
    return res.json({
      success: true,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update user status" });
  }
};

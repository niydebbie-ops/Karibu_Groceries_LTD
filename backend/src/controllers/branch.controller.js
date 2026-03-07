const Branch = require("../models/Branch");
const User = require("../models/User");

function normalizeBranchName(value) {
  return String(value || "").trim().toLowerCase();
}

exports.createBranch = async (req, res) => {
  try {
    const name = normalizeBranchName(req.body?.name);
    const location = String(req.body?.location || "").trim();
    const existing = await Branch.findOne({ name });
    if (existing) return res.status(409).json({ success: false, message: "Branch already exists" });

    const created = await Branch.create({ name, location, isActive: true, users: [] });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to create branch" });
  }
};

exports.getBranches = async (req, res) => {
  try {
    const rows = await Branch.find().populate("users", "fullName email role isActive").sort({ name: 1 });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch branches" });
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (req.body?.name) branch.name = normalizeBranchName(req.body.name);
    if (req.body?.location) branch.location = String(req.body.location).trim();
    await branch.save();

    return res.json({ success: true, data: branch });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update branch" });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    if ((branch.users || []).length > 0) {
      return res.status(400).json({ success: false, message: "Remove assigned users before deleting this branch" });
    }
    await branch.deleteOne();
    return res.json({ success: true, message: "Branch deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete branch" });
  }
};

exports.assignUserToBranch = async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    const branchId = String(req.body?.branchId || "");
    const [user, branch] = await Promise.all([
      User.findById(userId),
      Branch.findById(branchId).populate("users", "role isActive")
    ]);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    if (user.role === "Director") {
      return res.status(400).json({ success: false, message: "Director accounts cannot be assigned to branches" });
    }

    const activeUsers = (branch.users || []).filter((u) => u.isActive !== false);
    const managers = activeUsers.filter((u) => u.role === "Manager").length;
    const salesAgents = activeUsers.filter((u) => u.role === "SalesAgent").length;

    if (user.role === "Manager" && managers >= 1 && !branch.users.some((u) => String(u._id) === String(user._id))) {
      return res.status(400).json({ success: false, message: "This branch already has a manager" });
    }
    if (user.role === "SalesAgent" && salesAgents >= 2 && !branch.users.some((u) => String(u._id) === String(user._id))) {
      return res.status(400).json({ success: false, message: "This branch already has two sales agents" });
    }

    await Branch.updateMany({ users: user._id }, { $pull: { users: user._id } });
    await Branch.findByIdAndUpdate(branch._id, { $addToSet: { users: user._id } });

    const updated = await Branch.findById(branch._id).populate("users", "fullName email role isActive");
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to assign user to branch" });
  }
};

exports.setBranchActive = async (req, res) => {
  try {
    const isActive = Boolean(req.body?.isActive);
    const updated = await Branch.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).populate("users", "fullName email role isActive");

    if (!updated) return res.status(404).json({ success: false, message: "Branch not found" });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update branch status" });
  }
};

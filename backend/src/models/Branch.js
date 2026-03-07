const mongoose = require("../utils/mongoose");

const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

module.exports = mongoose.model("Branch", BranchSchema);

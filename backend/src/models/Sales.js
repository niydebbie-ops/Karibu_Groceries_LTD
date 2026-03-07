const mongoose = require("../utils/mongoose");

const SalesSchema = new mongoose.Schema({
  produceName: { type: String, required: true, lowercase: true, trim: true },
  tonnageKgs: { type: Number, required: true, min: 1 },
  amountPaidUgx: { type: Number, required: true, min: 0 },
  buyerName: { type: String, required: true, trim: true },
  salesAgentName: { type: String, required: true, trim: true },
  createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  createdByRole: { type: String, enum: ["Manager", "SalesAgent", "Director"], default: null },
  branchName: { type: String, required: true, lowercase: true, trim: true },
  saleDate: { type: Date, required: true, default: Date.now },
  saleTime: { type: String, required: true, default: () => new Date().toLocaleTimeString() }
});

module.exports = mongoose.model("Sales", SalesSchema);

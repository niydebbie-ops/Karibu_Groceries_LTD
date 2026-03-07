const mongoose = require("../utils/mongoose");

const CreditSchema = new mongoose.Schema({
  buyerName: { type: String, required: true, trim: true },
  nationalId: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  contact: { type: String, required: true, trim: true },
  originalAmountUgx: { type: Number, required: true, min: 0 },
  amountDueUgx: { type: Number, required: true, min: 0 },
  amountPaidUgx: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ["Pending", "Partial", "Paid", "Overdue"], default: "Pending" },
  lastPaymentDate: { type: Date, default: null },
  salesAgentName: { type: String, required: true, trim: true },
  dueDate: { type: Date, required: true },
  produceName: { type: String, required: true, lowercase: true, trim: true },
  produceType: { type: String, required: true, trim: true },
  tonnageKgs: { type: Number, required: true, min: 1 },
  dispatchDate: { type: Date, required: true },
  branchName: { type: String, required: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Credit", CreditSchema);

const mongoose = require("../utils/mongoose");

const ProcurementSchema = new mongoose.Schema({
  produceName: { type: String, required: true, trim: true, lowercase: true },
  produceType: { type: String, required: true, trim: true },
  tonnageKgs: { type: Number, required: true, min: 1 },
  costUgx: { type: Number, required: true, min: 0 },
  dealerName: { type: String, required: true, trim: true },
  dealerContact: { type: String, required: true, trim: true },
  sellingPriceUgx: { type: Number, required: true, min: 0 },
  branchName: { type: String, required: true, trim: true, lowercase: true },
  procurementDate: { type: Date, default: Date.now },
  procurementTime: { type: String, required: true, default: () => new Date().toLocaleTimeString() }
});

module.exports = mongoose.model("Procurement", ProcurementSchema);

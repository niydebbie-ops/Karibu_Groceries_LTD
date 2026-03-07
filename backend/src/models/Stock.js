const mongoose = require("../utils/mongoose");

const StockSchema = new mongoose.Schema({
  produceName: { type: String, required: true, lowercase: true, trim: true },
  type: { type: String, trim: true, default: "" },
  tonnageKgs: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  sellingPrice: { type: Number, min: 0, default: 0 },
  branchName: { type: String, required: true, lowercase: true, trim: true },
  lastUpdated: { type: Date, default: Date.now }
});

StockSchema.index({ produceName: 1, branchName: 1 }, { unique: true });

module.exports = mongoose.model("Stock", StockSchema);

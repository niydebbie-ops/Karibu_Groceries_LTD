const Stock = require("../models/Stock");

function normalizeBranch(req, bodyBranch) {
  return String(req.user?.branch || bodyBranch || "")
    .trim()
    .toLowerCase();
}

function mapStock(doc) {
  const quantity = Number(doc.tonnageKgs || 0);
  const status = quantity <= 0 ? "out of stock" : quantity < 500 ? "low" : "ok";
  return {
    _id: doc._id,
    produceName: doc.produceName,
    itemName: doc.produceName,
    type: doc.type || "",
    unit: doc.unit,
    tonnageKgs: quantity,
    quantity,
    sellingPrice: Number(doc.sellingPrice || 0),
    branchName: doc.branchName,
    branch: doc.branchName,
    status,
    updatedAt: doc.lastUpdated
  };
}

exports.createStock = async (req, res) => {
  try {
    const branchName = normalizeBranch(req, req.body?.branchName);
    const produceName = String(req.body?.produceName || "").trim().toLowerCase();
    const unit = String(req.body?.unit || "kg").trim();
    const tonnageKgs = Number(req.body?.tonnageKgs || 0);
    const sellingPrice = Number(req.body?.sellingPrice || 0);
    const type = String(req.body?.type || "").trim();

    const stock = await Stock.findOneAndUpdate(
      { produceName, branchName },
      {
        $set: {
          produceName,
          branchName,
          unit,
          type,
          sellingPrice,
          lastUpdated: new Date()
        },
        $inc: { tonnageKgs }
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(201).json({ success: true, data: mapStock(stock) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to create stock" });
  }
};

exports.getStocks = async (req, res) => {
  try {
    const query = {};
    if (req.user?.role !== "Director" && req.user?.branch) {
      query.branchName = String(req.user.branch).toLowerCase();
    }
    const stocks = await Stock.find(query).sort({ produceName: 1 });
    return res.json({ success: true, data: stocks.map(mapStock) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch stock" });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).json({ success: false, message: "Stock record not found" });

    const userBranch = String(req.user?.branch || "").toLowerCase();
    if (userBranch && stock.branchName !== userBranch) {
      return res.status(403).json({ success: false, message: "Forbidden: branch restriction" });
    }

    stock.produceName = String(req.body?.produceName || stock.produceName).trim().toLowerCase();
    stock.type = String(req.body?.type ?? stock.type ?? "").trim();
    stock.unit = String(req.body?.unit || stock.unit).trim();
    stock.tonnageKgs = Number(req.body?.tonnageKgs ?? stock.tonnageKgs);
    stock.sellingPrice = Number(req.body?.sellingPrice ?? stock.sellingPrice ?? 0);
    stock.lastUpdated = req.body?.updatedAt ? new Date(req.body.updatedAt) : new Date();
    if (req.body?.branchName) {
      stock.branchName = normalizeBranch(req, req.body.branchName);
    }

    await stock.save();
    return res.json({ success: true, data: mapStock(stock) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update stock" });
  }
};

exports.deleteStock = async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).json({ success: false, message: "Stock record not found" });

    const userBranch = String(req.user?.branch || "").toLowerCase();
    if (userBranch && stock.branchName !== userBranch) {
      return res.status(403).json({ success: false, message: "Forbidden: branch restriction" });
    }

    await stock.deleteOne();
    return res.json({ success: true, message: "Stock deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete stock" });
  }
};

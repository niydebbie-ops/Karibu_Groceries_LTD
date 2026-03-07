const Procurement = require("../models/Procurement");
const Stock = require("../models/Stock");

function toBranch(req, branchFromBody) {
  return String(req.user?.branch || branchFromBody || "")
    .trim()
    .toLowerCase();
}

async function adjustStock(produceName, branchName, deltaKgs, unitPrice) {
  const stock = await Stock.findOne({ produceName, branchName });
  if (!stock && deltaKgs < 0) return { ok: false, message: "Insufficient stock for adjustment" };

  if (!stock && deltaKgs > 0) {
    const created = await Stock.create({
      produceName,
      type: "",
      tonnageKgs: deltaKgs,
      unit: "kg",
      sellingPrice: Number(unitPrice || 0),
      branchName
    });
    return { ok: true, stock: created };
  }

  const nextQty = Number(stock.tonnageKgs || 0) + Number(deltaKgs || 0);
  if (nextQty < 0) return { ok: false, message: "Insufficient stock for this operation" };

  stock.tonnageKgs = nextQty;
  if (Number(unitPrice || 0) > 0) stock.sellingPrice = Number(unitPrice);
  stock.lastUpdated = new Date();
  await stock.save();
  return { ok: true, stock };
}

function mapProcurement(doc) {
  return {
    _id: doc._id,
    produceName: doc.produceName,
    itemName: doc.produceName,
    produceType: doc.produceType,
    type: doc.produceType,
    tonnageKgs: Number(doc.tonnageKgs || 0),
    tonnage: Number(doc.tonnageKgs || 0),
    costUgx: Number(doc.costUgx || 0),
    dealerName: doc.dealerName,
    dealerContact: doc.dealerContact,
    sellingPriceUgx: Number(doc.sellingPriceUgx || 0),
    branchName: doc.branchName,
    branch: doc.branchName,
    procurementDate: doc.procurementDate,
    date: doc.procurementDate,
    procurementTime: doc.procurementTime,
    time: doc.procurementTime
  };
}

exports.createProcurement = async (req, res) => {
  try {
    const payload = {
      produceName: String(req.body?.produceName || "").trim().toLowerCase(),
      produceType: String(req.body?.produceType || "").trim(),
      tonnageKgs: Number(req.body?.tonnageKgs || 0),
      costUgx: Number(req.body?.costUgx || 0),
      dealerName: String(req.body?.dealerName || "").trim(),
      dealerContact: String(req.body?.dealerContact || "").trim(),
      sellingPriceUgx: Number(req.body?.sellingPriceUgx || 0),
      branchName: toBranch(req, req.body?.branchName),
      procurementDate: req.body?.procurementDate ? new Date(req.body.procurementDate) : new Date(),
      procurementTime: String(req.body?.procurementTime || new Date().toLocaleTimeString())
    };

    const created = await Procurement.create(payload);
    const stockResult = await adjustStock(
      payload.produceName,
      payload.branchName,
      payload.tonnageKgs,
      payload.sellingPriceUgx
    );

    if (!stockResult.ok) {
      await created.deleteOne();
      return res.status(400).json({ success: false, message: stockResult.message });
    }

    return res.status(201).json({ success: true, data: mapProcurement(created) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to create procurement" });
  }
};

exports.getProcurements = async (req, res) => {
  try {
    const query = {};
    if (req.user?.role !== "Director" && req.user?.branch) {
      query.branchName = String(req.user.branch).toLowerCase();
    }
    const rows = await Procurement.find(query).sort({ procurementDate: -1, createdAt: -1 });
    return res.json({ success: true, data: rows.map(mapProcurement) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch procurements" });
  }
};

exports.updateProcurement = async (req, res) => {
  try {
    const existing = await Procurement.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Procurement record not found" });

    const userBranch = String(req.user?.branch || "").toLowerCase();
    if (userBranch && existing.branchName !== userBranch) {
      return res.status(403).json({ success: false, message: "Forbidden: branch restriction" });
    }

    const next = {
      produceName: String(req.body?.produceName || existing.produceName).trim().toLowerCase(),
      produceType: String(req.body?.produceType || existing.produceType).trim(),
      tonnageKgs: Number(req.body?.tonnageKgs ?? existing.tonnageKgs),
      costUgx: Number(req.body?.costUgx ?? existing.costUgx),
      dealerName: String(req.body?.dealerName || existing.dealerName).trim(),
      dealerContact: String(req.body?.dealerContact || existing.dealerContact).trim(),
      sellingPriceUgx: Number(req.body?.sellingPriceUgx ?? existing.sellingPriceUgx),
      branchName: toBranch(req, req.body?.branchName || existing.branchName),
      procurementDate: req.body?.procurementDate ? new Date(req.body.procurementDate) : existing.procurementDate,
      procurementTime: String(req.body?.procurementTime || existing.procurementTime)
    };

    const rollbackOld = await adjustStock(existing.produceName, existing.branchName, -Number(existing.tonnageKgs || 0), existing.sellingPriceUgx);
    if (!rollbackOld.ok) {
      return res.status(400).json({ success: false, message: "Cannot update procurement: stock already consumed" });
    }

    const applyNew = await adjustStock(next.produceName, next.branchName, next.tonnageKgs, next.sellingPriceUgx);
    if (!applyNew.ok) {
      await adjustStock(existing.produceName, existing.branchName, Number(existing.tonnageKgs || 0), existing.sellingPriceUgx);
      return res.status(400).json({ success: false, message: applyNew.message });
    }

    Object.assign(existing, next);
    await existing.save();
    return res.json({ success: true, data: mapProcurement(existing) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update procurement" });
  }
};

exports.deleteProcurement = async (req, res) => {
  try {
    const existing = await Procurement.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Procurement record not found" });

    const userBranch = String(req.user?.branch || "").toLowerCase();
    if (userBranch && existing.branchName !== userBranch) {
      return res.status(403).json({ success: false, message: "Forbidden: branch restriction" });
    }

    const stockResult = await adjustStock(existing.produceName, existing.branchName, -Number(existing.tonnageKgs || 0), existing.sellingPriceUgx);
    if (!stockResult.ok) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete procurement because related stock has already been sold/dispatched"
      });
    }

    await existing.deleteOne();
    return res.json({ success: true, message: "Procurement deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete procurement" });
  }
};

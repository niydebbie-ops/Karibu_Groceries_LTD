const Sales = require("../models/Sales");
const Stock = require("../models/Stock");
const Procurement = require("../models/Procurement");
const { normalizeProduceName } = require("../utils/produce");

function toBranch(req, bodyBranch) {
  return String(req.user?.branch || bodyBranch || "")
    .trim()
    .toLowerCase();
}

function mapSale(doc) {
  return {
    _id: doc._id,
    produceName: doc.produceName,
    itemName: doc.produceName,
    tonnageKgs: Number(doc.tonnageKgs || 0),
    tonnage: Number(doc.tonnageKgs || 0),
    amountPaidUgx: Number(doc.amountPaidUgx || 0),
    amountPaid: Number(doc.amountPaidUgx || 0),
    buyerName: doc.buyerName,
    salesAgentName: doc.salesAgentName,
    agentName: doc.salesAgentName,
    createdByUserId: doc.createdByUserId,
    createdByRole: doc.createdByRole,
    branchName: doc.branchName,
    branch: doc.branchName,
    saleDate: doc.saleDate,
    date: doc.saleDate,
    saleTime: doc.saleTime,
    time: doc.saleTime
  };
}

async function adjustStock(produceName, branchName, deltaKgs) {
  const stock = await Stock.findOne({ produceName, branchName });
  if (!stock) return { ok: false, message: "Stock record not found for selected produce" };

  const nextQty = Number(stock.tonnageKgs || 0) + Number(deltaKgs || 0);
  if (nextQty < 0) return { ok: false, message: "Insufficient stock for this sale" };

  stock.tonnageKgs = nextQty;
  stock.lastUpdated = new Date();
  await stock.save();
  return { ok: true, stock };
}

function canManageSale(req, sale) {
  if (req.user?.role === "Director") return true;
  if (req.user?.role === "Manager") return sale.branchName === String(req.user.branch || "").toLowerCase();
  return String(sale.createdByUserId || "") === String(req.user?.id || "");
}

function getProduceCandidates(value) {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = normalizeProduceName(raw);
  const candidates = new Set([raw]);

  if (normalized) candidates.add(normalized);

  if (raw === "maize" || normalized === "maize") candidates.add("grain maize");
  if (raw === "grain maize" || normalized === "grain maize") candidates.add("maize");

  if (raw === "peas" || raw === "cowpea" || raw === "cowpeas" || normalized === "cow peas") {
    candidates.add("cow peas");
    candidates.add("peas");
  }

  return Array.from(candidates).filter(Boolean);
}

exports.createSale = async (req, res) => {
  try {
    const payload = {
      produceName: String(req.body?.produceName || "").trim().toLowerCase(),
      tonnageKgs: Number(req.body?.tonnageKgs || 0),
      amountPaidUgx: Number(req.body?.amountPaidUgx || 0),
      buyerName: String(req.body?.buyerName || "").trim(),
      salesAgentName: String(req.body?.salesAgentName || req.user?.fullName || "").trim(),
      createdByUserId: req.user?.id || null,
      createdByRole: req.user?.role || null,
      branchName: toBranch(req, req.body?.branchName),
      saleDate: req.body?.saleDate ? new Date(req.body.saleDate) : new Date(),
      saleTime: String(req.body?.saleTime || new Date().toLocaleTimeString())
    };

    const stockResult = await adjustStock(payload.produceName, payload.branchName, -payload.tonnageKgs);
    if (!stockResult.ok) return res.status(400).json({ success: false, message: stockResult.message });

    const created = await Sales.create(payload);
    return res.status(201).json({
      success: true,
      notification: "Sale recorded successfully.",
      data: mapSale(created)
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to create sale" });
  }
};

exports.getSales = async (req, res) => {
  try {
    const query = {};
    if (req.user?.role !== "Director" && req.user?.branch) {
      query.branchName = String(req.user.branch).toLowerCase();
    }
    const rows = await Sales.find(query).sort({ saleDate: -1, createdAt: -1 });
    return res.json({ success: true, data: rows.map(mapSale) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch sales" });
  }
};

exports.updateSale = async (req, res) => {
  try {
    const existing = await Sales.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Sale record not found" });
    if (!canManageSale(req, existing)) {
      return res.status(403).json({ success: false, message: "Forbidden: you can only manage your own sale entries" });
    }

    const next = {
      produceName: String(req.body?.produceName || existing.produceName).trim().toLowerCase(),
      tonnageKgs: Number(req.body?.tonnageKgs ?? existing.tonnageKgs),
      amountPaidUgx: Number(req.body?.amountPaidUgx ?? existing.amountPaidUgx),
      buyerName: String(req.body?.buyerName || existing.buyerName).trim(),
      salesAgentName: String(req.body?.salesAgentName || existing.salesAgentName).trim(),
      branchName: toBranch(req, req.body?.branchName || existing.branchName),
      saleDate: req.body?.saleDate ? new Date(req.body.saleDate) : existing.saleDate,
      saleTime: String(req.body?.saleTime || existing.saleTime)
    };

    const rollbackOld = await adjustStock(existing.produceName, existing.branchName, Number(existing.tonnageKgs || 0));
    if (!rollbackOld.ok) return res.status(400).json({ success: false, message: rollbackOld.message });

    const applyNew = await adjustStock(next.produceName, next.branchName, -next.tonnageKgs);
    if (!applyNew.ok) {
      await adjustStock(existing.produceName, existing.branchName, -Number(existing.tonnageKgs || 0));
      return res.status(400).json({ success: false, message: applyNew.message });
    }

    Object.assign(existing, next);
    await existing.save();

    return res.json({
      success: true,
      notification: "Sale updated successfully.",
      data: mapSale(existing)
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update sale" });
  }
};

exports.deleteSale = async (req, res) => {
  try {
    const existing = await Sales.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Sale record not found" });
    if (!canManageSale(req, existing)) {
      return res.status(403).json({ success: false, message: "Forbidden: you can only manage your own sale entries" });
    }

    const stockResult = await adjustStock(existing.produceName, existing.branchName, Number(existing.tonnageKgs || 0));
    if (!stockResult.ok) return res.status(400).json({ success: false, message: stockResult.message });

    await existing.deleteOne();
    return res.json({ success: true, message: "Sale deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete sale" });
  }
};

exports.getUnitPrice = async (req, res) => {
  try {
    const produceName = String(req.query?.produceName || "").trim().toLowerCase();
    const branchName = String(req.user?.branch || "").trim().toLowerCase();
    if (!produceName) return res.status(400).json({ success: false, message: "produceName is required" });
    if (!branchName && req.user?.role !== "Director") {
      return res.status(400).json({ success: false, message: "No branch assigned to current user" });
    }

    const produceCandidates = getProduceCandidates(produceName);
    const stock = await Stock.findOne({
      produceName: { $in: produceCandidates },
      ...(branchName ? { branchName } : {})
    }).sort({ sellingPrice: -1, lastUpdated: -1 });

    let unitPrice = Number(stock?.sellingPrice || 0);

    // Fallback: older data may have selling price only in procurement history.
    if (unitPrice <= 0) {
      const procurement = await Procurement.findOne({
        produceName: { $in: produceCandidates },
        ...(branchName ? { branchName } : {})
      }).sort({ procurementDate: -1, createdAt: -1, sellingPriceUgx: -1 });
      unitPrice = Number(procurement?.sellingPriceUgx || 0);
    }

    if (unitPrice <= 0) {
      return res.status(404).json({ success: false, message: "Selling price not found for selected produce" });
    }

    return res.json({
      success: true,
      data: {
        produceName: normalizeProduceName(produceName) || produceName,
        branchName: stock?.branchName || branchName,
        unitPrice
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch unit price" });
  }
};

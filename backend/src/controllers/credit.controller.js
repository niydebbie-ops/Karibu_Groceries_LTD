const Credit = require("../models/Credit");
const Stock = require("../models/Stock");

function toBranch(req, bodyBranch) {
  return String(req.user?.branch || bodyBranch || "")
    .trim()
    .toLowerCase();
}

function getPaymentStatus(amountDue, dueDate) {
  const due = Number(amountDue || 0);
  if (due <= 0) return "Paid";
  const now = new Date();
  const dueDt = new Date(dueDate);
  if (Number.isFinite(dueDt.getTime()) && dueDt < now) return "Overdue";
  return "Pending";
}

function mapCredit(doc) {
  return {
    _id: doc._id,
    buyerName: doc.buyerName,
    nationalId: doc.nationalId,
    nin: doc.nationalId,
    location: doc.location,
    contact: doc.contact,
    originalAmountUgx: Number(doc.originalAmountUgx || 0),
    originalAmount: Number(doc.originalAmountUgx || 0),
    amountDueUgx: Number(doc.amountDueUgx || 0),
    amountDue: Number(doc.amountDueUgx || 0),
    amountPaidUgx: Number(doc.amountPaidUgx || 0),
    amountPaid: Number(doc.amountPaidUgx || 0),
    paymentStatus: doc.paymentStatus,
    salesAgentName: doc.salesAgentName,
    agentName: doc.salesAgentName,
    dueDate: doc.dueDate,
    produceName: doc.produceName,
    itemName: doc.produceName,
    produceType: doc.produceType,
    type: doc.produceType,
    tonnageKgs: Number(doc.tonnageKgs || 0),
    tonnage: Number(doc.tonnageKgs || 0),
    dispatchDate: doc.dispatchDate,
    branchName: doc.branchName,
    branch: doc.branchName,
    lastPaymentDate: doc.lastPaymentDate
  };
}

async function adjustStock(produceName, branchName, deltaKgs) {
  const stock = await Stock.findOne({ produceName, branchName });
  if (!stock) return { ok: false, message: "Stock record not found for selected produce" };
  const nextQty = Number(stock.tonnageKgs || 0) + Number(deltaKgs || 0);
  if (nextQty < 0) return { ok: false, message: "Insufficient stock for this credit dispatch" };
  stock.tonnageKgs = nextQty;
  stock.lastUpdated = new Date();
  await stock.save();
  return { ok: true, stock };
}

exports.createCredit = async (req, res) => {
  try {
    const amountDue = Number(req.body?.amountDueUgx || 0);
    const payload = {
      buyerName: String(req.body?.buyerName || "").trim(),
      nationalId: String(req.body?.nationalId || "").trim().toUpperCase(),
      location: String(req.body?.location || "").trim(),
      contact: String(req.body?.contact || "").trim(),
      originalAmountUgx: amountDue,
      amountDueUgx: amountDue,
      amountPaidUgx: 0,
      paymentStatus: getPaymentStatus(amountDue, req.body?.dueDate),
      salesAgentName: String(req.body?.salesAgentName || req.user?.fullName || "").trim(),
      dueDate: new Date(req.body?.dueDate),
      produceName: String(req.body?.produceName || "").trim().toLowerCase(),
      produceType: String(req.body?.produceType || "").trim(),
      tonnageKgs: Number(req.body?.tonnageKgs || 0),
      dispatchDate: req.body?.dispatchDate ? new Date(req.body.dispatchDate) : new Date(),
      branchName: toBranch(req, req.body?.branchName)
    };

    const stockResult = await adjustStock(payload.produceName, payload.branchName, -payload.tonnageKgs);
    if (!stockResult.ok) return res.status(400).json({ success: false, message: stockResult.message });

    const created = await Credit.create(payload);
    return res.status(201).json({
      success: true,
      notification: "Credit sale recorded successfully.",
      data: mapCredit(created)
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to create credit sale" });
  }
};

exports.getCredits = async (req, res) => {
  try {
    const query = {};
    if (req.user?.role !== "Director" && req.user?.branch) {
      query.branchName = String(req.user.branch).toLowerCase();
    }
    const rows = await Credit.find(query).sort({ dueDate: 1, createdAt: -1 });
    return res.json({ success: true, data: rows.map(mapCredit) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch credit sales" });
  }
};

exports.updateCredit = async (req, res) => {
  try {
    const existing = await Credit.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Credit record not found" });

    const userBranch = String(req.user?.branch || "").toLowerCase();
    if (userBranch && existing.branchName !== userBranch) {
      return res.status(403).json({ success: false, message: "Forbidden: branch restriction" });
    }

    const next = {
      buyerName: String(req.body?.buyerName || existing.buyerName).trim(),
      nationalId: String(req.body?.nationalId || existing.nationalId).trim().toUpperCase(),
      location: String(req.body?.location || existing.location).trim(),
      contact: String(req.body?.contact || existing.contact).trim(),
      amountDueUgx: Number(req.body?.amountDueUgx ?? existing.amountDueUgx),
      salesAgentName: String(req.body?.salesAgentName || existing.salesAgentName).trim(),
      dueDate: req.body?.dueDate ? new Date(req.body.dueDate) : existing.dueDate,
      produceName: String(req.body?.produceName || existing.produceName).trim().toLowerCase(),
      produceType: String(req.body?.produceType || existing.produceType).trim(),
      tonnageKgs: Number(req.body?.tonnageKgs ?? existing.tonnageKgs),
      dispatchDate: req.body?.dispatchDate ? new Date(req.body.dispatchDate) : existing.dispatchDate,
      branchName: toBranch(req, req.body?.branchName || existing.branchName)
    };

    const rollbackOld = await adjustStock(existing.produceName, existing.branchName, Number(existing.tonnageKgs || 0));
    if (!rollbackOld.ok) return res.status(400).json({ success: false, message: rollbackOld.message });

    const applyNew = await adjustStock(next.produceName, next.branchName, -next.tonnageKgs);
    if (!applyNew.ok) {
      await adjustStock(existing.produceName, existing.branchName, -Number(existing.tonnageKgs || 0));
      return res.status(400).json({ success: false, message: applyNew.message });
    }

    const originalAmount = Number(existing.originalAmountUgx || 0);
    const paid = Number(existing.amountPaidUgx || 0);
    const updatedDue = Number(next.amountDueUgx);
    const nextOriginal = Math.max(originalAmount, paid + updatedDue);

    Object.assign(existing, next);
    existing.originalAmountUgx = nextOriginal;
    existing.paymentStatus = getPaymentStatus(existing.amountDueUgx, existing.dueDate);
    await existing.save();

    return res.json({
      success: true,
      notification: "Credit sale updated successfully.",
      data: mapCredit(existing)
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update credit sale" });
  }
};

exports.deleteCredit = async (req, res) => {
  try {
    const existing = await Credit.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Credit record not found" });

    const userBranch = String(req.user?.branch || "").toLowerCase();
    if (userBranch && existing.branchName !== userBranch) {
      return res.status(403).json({ success: false, message: "Forbidden: branch restriction" });
    }

    const stockResult = await adjustStock(existing.produceName, existing.branchName, Number(existing.tonnageKgs || 0));
    if (!stockResult.ok) return res.status(400).json({ success: false, message: stockResult.message });

    await existing.deleteOne();
    return res.json({ success: true, message: "Credit sale deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete credit sale" });
  }
};

exports.payCredit = async (req, res) => {
  try {
    const existing = await Credit.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Credit record not found" });

    const userBranch = String(req.user?.branch || "").toLowerCase();
    if (userBranch && existing.branchName !== userBranch) {
      return res.status(403).json({ success: false, message: "Forbidden: branch restriction" });
    }

    const amount = Number(req.body?.amountPaidUgx || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
    }

    if (amount > Number(existing.amountDueUgx || 0)) {
      return res.status(400).json({ success: false, message: "Payment cannot exceed amount due" });
    }

    existing.amountPaidUgx = Number(existing.amountPaidUgx || 0) + amount;
    existing.amountDueUgx = Number(existing.amountDueUgx || 0) - amount;
    existing.lastPaymentDate = new Date();
    if (existing.amountDueUgx <= 0) {
      existing.amountDueUgx = 0;
      existing.paymentStatus = "Paid";
    } else {
      existing.paymentStatus = "Partial";
    }

    await existing.save();
    return res.json({ success: true, data: mapCredit(existing) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to record payment" });
  }
};

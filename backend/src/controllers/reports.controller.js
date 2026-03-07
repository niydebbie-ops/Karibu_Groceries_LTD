const Sales = require("../models/Sales");
const Credit = require("../models/Credit");
const Stock = require("../models/Stock");

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

exports.getSummary = async (req, res) => {
  try {
    const [salesAgg, creditAgg, stockAgg, todaySalesAgg, pendingCreditCount] = await Promise.all([
      Sales.aggregate([{ $group: { _id: null, total: { $sum: "$amountPaidUgx" } } }]),
      Credit.aggregate([{ $group: { _id: null, total: { $sum: "$amountDueUgx" } } }]),
      Stock.aggregate([{ $group: { _id: null, total: { $sum: "$tonnageKgs" } } }]),
      Sales.aggregate([
        { $match: { saleDate: { $gte: startOfToday() } } },
        { $group: { _id: null, total: { $sum: "$amountPaidUgx" } } }
      ]),
      Credit.countDocuments({ amountDueUgx: { $gt: 0 } })
    ]);

    return res.json({
      success: true,
      data: {
        totalSales: Number(salesAgg[0]?.total || 0),
        totalCredits: Number(creditAgg[0]?.total || 0),
        totalStocks: Number(stockAgg[0]?.total || 0),
        todaySales: Number(todaySalesAgg[0]?.total || 0),
        pendingCredits: Number(pendingCreditCount || 0)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch summary" });
  }
};

exports.getReports = async (req, res) => {
  try {
    const today = startOfToday();
    const [salesByBranch, creditsByBranch, stocksByBranch, salesTodayByBranch, creditsTodayByBranch] = await Promise.all([
      Sales.aggregate([
        {
          $group: {
            _id: "$branchName",
            totalAmount: { $sum: "$amountPaidUgx" },
            totalTonnage: { $sum: "$tonnageKgs" },
            salesRecordsCount: { $sum: 1 }
          }
        }
      ]),
      Credit.aggregate([
        {
          $group: {
            _id: "$branchName",
            totalCredit: { $sum: "$amountDueUgx" },
            creditRecordsCount: { $sum: 1 }
          }
        }
      ]),
      Stock.aggregate([
        {
          $group: {
            _id: "$branchName",
            totalStockKgs: { $sum: "$tonnageKgs" }
          }
        }
      ]),
      Sales.aggregate([
        { $match: { saleDate: { $gte: today } } },
        {
          $group: {
            _id: "$branchName",
            salesRecordsToday: { $sum: 1 },
            salesTodayAmount: { $sum: "$amountPaidUgx" }
          }
        }
      ]),
      Credit.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: "$branchName",
            creditRecordsToday: { $sum: 1 }
          }
        }
      ])
    ]);

    const normalize = (rows, mapper) => rows.map((r) => mapper(r));
    const salesRows = normalize(salesByBranch, (r) => ({
      branchName: r._id || "",
      totalAmount: Number(r.totalAmount || 0),
      totalTonnage: Number(r.totalTonnage || 0),
      salesRecordsCount: Number(r.salesRecordsCount || 0)
    }));
    const creditRows = normalize(creditsByBranch, (r) => ({
      branchName: r._id || "",
      totalCredit: Number(r.totalCredit || 0),
      creditRecordsCount: Number(r.creditRecordsCount || 0)
    }));
    const stockRows = normalize(stocksByBranch, (r) => ({
      branchName: r._id || "",
      totalStockKgs: Number(r.totalStockKgs || 0)
    }));
    const salesTodayRows = normalize(salesTodayByBranch, (r) => ({
      branchName: r._id || "",
      salesRecordsToday: Number(r.salesRecordsToday || 0),
      salesTodayAmount: Number(r.salesTodayAmount || 0)
    }));
    const creditsTodayRows = normalize(creditsTodayByBranch, (r) => ({
      branchName: r._id || "",
      creditRecordsToday: Number(r.creditRecordsToday || 0)
    }));

    const allBranches = new Set([
      ...salesRows.map((r) => r.branchName),
      ...creditRows.map((r) => r.branchName),
      ...stockRows.map((r) => r.branchName)
    ]);

    const byBranch = Array.from(allBranches)
      .filter(Boolean)
      .map((branchName) => {
        const s = salesRows.find((x) => x.branchName === branchName) || {};
        const c = creditRows.find((x) => x.branchName === branchName) || {};
        const st = stockRows.find((x) => x.branchName === branchName) || {};
        return {
          branchName,
          totalAmount: Number(s.totalAmount || 0),
          totalTonnage: Number(s.totalTonnage || 0),
          totalCredit: Number(c.totalCredit || 0),
          totalStockKgs: Number(st.totalStockKgs || 0),
          salesRecordsCount: Number(s.salesRecordsCount || 0),
          creditRecordsCount: Number(c.creditRecordsCount || 0),
          status: Number(c.totalCredit || 0) > 0 ? "Pending" : "Paid"
        };
      });

    return res.json({
      success: true,
      data: {
        salesByBranch: salesRows,
        creditsByBranch: creditRows,
        stocksByBranch: stockRows,
        salesTodayByBranch: salesTodayRows,
        creditsTodayByBranch: creditsTodayRows,
        branchSummary: byBranch
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch reports" });
  }
};

exports.getBranchOverview = async (req, res) => {
  try {
    const branchName = String(req.user?.branch || "").toLowerCase();
    const canViewStock = req.user?.role === "Manager";

    const [salesAgg, creditAgg, stockAgg, salesCount, creditCount, credits] = await Promise.all([
      Sales.aggregate([
        { $match: { branchName } },
        { $group: { _id: null, totalCashSales: { $sum: "$amountPaidUgx" } } }
      ]),
      Credit.aggregate([
        { $match: { branchName } },
        { $group: { _id: null, outstandingCredit: { $sum: "$amountDueUgx" } } }
      ]),
      Stock.aggregate([
        { $match: { branchName } },
        { $group: { _id: null, totalStockKgs: { $sum: "$tonnageKgs" } } }
      ]),
      Sales.countDocuments({ branchName }),
      Credit.countDocuments({ branchName }),
      Credit.find({ branchName }).sort({ dueDate: 1 })
    ]);

    const row = {
      branchName,
      totalCashSales: Number(salesAgg[0]?.totalCashSales || 0),
      outstandingCredit: Number(creditAgg[0]?.outstandingCredit || 0),
      totalStockKgs: Number(stockAgg[0]?.totalStockKgs || 0),
      salesCount: Number(salesCount || 0),
      creditCount: Number(creditCount || 0),
      creditStatus: Number(creditAgg[0]?.outstandingCredit || 0) > 0 ? "Pending" : "Paid"
    };

    const creditCustomers = credits.map((c) => ({
      buyerName: c.buyerName,
      branchName: c.branchName,
      produceName: c.produceName,
      contact: c.contact,
      salesAgentName: c.salesAgentName,
      amountPaidUgx: Number(c.amountPaidUgx || 0),
      amountDueUgx: Number(c.amountDueUgx || 0),
      dueDate: c.dueDate,
      paymentStatus: c.paymentStatus
    }));

    return res.json({
      success: true,
      data: {
        canViewStock,
        rows: branchName ? [row] : [],
        creditCustomers
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch branch overview" });
  }
};

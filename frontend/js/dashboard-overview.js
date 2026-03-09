(() => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const authToken = localStorage.getItem("token");
  const currentRole = localStorage.getItem("role") || "";

  function normalizeBranch(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function formatBranch(value) {
    const branch = normalizeBranch(value);
    if (branch === "maganjo") return "Maganjo";
    if (branch === "matugga") return "Matugga";
    if (!branch) return "Unassigned";
    return branch
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getStatusRank(status) {
    const value = String(status || "").trim();
    if (value === "Overdue") return 4;
    if (value === "Partial") return 3;
    if (value === "Pending") return 2;
    if (value === "Paid") return 1;
    return 0;
  }

  function getStatusClass(status) {
    const value = String(status || "Pending");
    if (value === "Paid") return "status-paid";
    if (value === "Partial") return "status-partial";
    if (value === "Overdue") return "status-overdue";
    return "status-pending";
  }

  function formatDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function formatUgx(value) {
    return `UGX ${Number(value || 0).toLocaleString()}`;
  }

  async function apiFetch(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      throw new Error(`Invalid server response for ${path}`);
    }
    if (!res.ok || !data.success) {
      if (path === "/api/reports/branch-overview" && res.status === 404) return null;
      const apiMessage = String(data?.message || "").trim();
      throw new Error(apiMessage || `Failed request ${path} (HTTP ${res.status})`);
    }
    return data.data;
  }

  function buildOverviewFromLegacy(sales, credits, stocks, canViewStock) {
    const grouped = new Map();

    const ensureBranch = (branchName) => {
      const key = normalizeBranch(branchName) || "unassigned";
      if (!grouped.has(key)) {
        grouped.set(key, {
          branchName: key,
          totalCashSales: 0,
          outstandingCredit: 0,
          totalStockKgs: 0,
          salesCount: 0,
          creditCount: 0,
          creditStatus: "Paid",
          creditStatusRank: 1
        });
      }
      return grouped.get(key);
    };

    (sales || []).forEach((s) => {
      const row = ensureBranch(s.branch || s.branchName);
      row.totalCashSales += Number(s.amountPaid || s.amountPaidUgx || 0);
      row.salesCount += 1;
    });

    (credits || []).forEach((c) => {
      const row = ensureBranch(c.branch || c.branchName);
      row.outstandingCredit += Number(c.amountDue || c.amountDueUgx || 0);
      row.creditCount += 1;
      const rank = getStatusRank(c.paymentStatus);
      if (rank > row.creditStatusRank) {
        row.creditStatus = String(c.paymentStatus || "Pending");
        row.creditStatusRank = rank;
      }
    });

    if (canViewStock) {
      (stocks || []).forEach((st) => {
        const row = ensureBranch(st.branch || st.branchName);
        row.totalStockKgs += Number(st.tonnageKgs || st.quantity || 0);
      });
    }

    return Array.from(grouped.values())
      .map((row) => {
        const { creditStatusRank, ...rest } = row;
        return rest;
      })
      .sort((a, b) => String(a.branchName).localeCompare(String(b.branchName)));
  }

  async function loadDashboardOverview(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "<p>Loading overview...</p>";

    try {
      let overview = await apiFetch("/api/reports/branch-overview");
      let canViewStock = Boolean(overview?.canViewStock);
      let rows = Array.isArray(overview?.rows) ? overview.rows : [];
      let creditCustomers = Array.isArray(overview?.creditCustomers) ? overview.creditCustomers : [];

      if (!overview) {
        canViewStock = currentRole === "Manager";
        const requests = [apiFetch("/api/sales"), apiFetch("/api/credit")];
        if (canViewStock) requests.push(apiFetch("/api/stock"));
        const [sales, credits, stocks = []] = await Promise.all(requests);
        rows = buildOverviewFromLegacy(sales, credits, stocks, canViewStock);
        creditCustomers = Array.isArray(credits)
          ? credits.map((c) => ({
              buyerName: c.buyerName || "Unknown",
              branchName: c.branch || c.branchName || "unassigned",
              produceName: c.itemName || c.produceName || "",
              contact: c.contact || "",
              salesAgentName: c.agentName || c.salesAgentName || "",
              amountPaidUgx: Number(c.amountPaid || c.amountPaidUgx || 0),
              amountDueUgx: Number(c.amountDue || c.amountDueUgx || 0),
              dueDate: c.dueDate || null,
              paymentStatus: c.paymentStatus || "Pending"
            }))
          : [];
      }

      // Recover buyer-level rows when API returns only branch aggregates.
      if (creditCustomers.length === 0) {
        const credits = await apiFetch("/api/credit");
        if (Array.isArray(credits) && credits.length > 0) {
          creditCustomers = credits.map((c) => ({
            buyerName: c.buyerName || "",
            branchName: c.branch || c.branchName || "unassigned",
            produceName: c.itemName || c.produceName || "",
            contact: c.contact || "",
            salesAgentName: c.agentName || c.salesAgentName || "",
            amountPaidUgx: Number(c.amountPaid || c.amountPaidUgx || 0),
            amountDueUgx: Number(c.amountDue || c.amountDueUgx || 0),
            dueDate: c.dueDate || null,
            paymentStatus: c.paymentStatus || "Pending"
          }));
        }
      }

      if (options.forceHideStock === true) {
        canViewStock = false;
      }

      if (rows.length === 0) {
        container.innerHTML = "<p>No overview data available yet.</p>";
        return;
      }

      const cardsHtml = rows
        .map((data) => {
          const branch = data.branchName;
          const thirdCard = canViewStock
            ? `
                <article class="metric-card metric-stock">
                  <p class="metric-label">📦 TOTAL STOCK (KG)</p>
                  <p class="metric-value">${Number(data.totalStockKgs || 0).toLocaleString()}</p>
                </article>
              `
            : options.hideCreditSalesCard
              ? ""
              : `
                <article class="metric-card metric-count">
                  <p class="metric-label">💳 CREDIT SALES RECORDS</p>
                  <p class="metric-value">${Number(data.creditCount || 0).toLocaleString()}</p>
                </article>
              `;
          return `
            <section class="overview-branch-card">
              <div class="overview-metrics">
                <article class="metric-card metric-cash">
                  <p class="metric-label">💵 TOTAL CASH SALES</p>
                  <p class="metric-value">${formatUgx(data.totalCashSales)}</p>
                </article>
                <article class="metric-card metric-credit">
                  <p class="metric-label">📉 OUTSTANDING CREDIT</p>
                  <p class="metric-value">${formatUgx(data.outstandingCredit)}</p>
                </article>
                ${thirdCard}
              </div>
            </section>
          `;
        })
        .join("");

      const tableHtml = `
        <section class="overview-branch-card">
          <h3>📊 ${options.tableTitle || "Branch Performance Summary"}</h3>
          <div class="table-scroll">
            <table class="table-modern overview-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Total Cash Sales (UGX)</th>
                  <th>Outstanding Credit (UGX)</th>
                  ${canViewStock ? "<th>Total Stock (KG)</th>" : ""}
                  <th>Sales Records</th>
                  <th>Credit Records</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length > 0
                    ? rows
                        .map((r) => {
                          return `
                            <tr>
                              <td>${formatBranch(r.branchName)}</td>
                              <td>${formatUgx(r.totalCashSales)}</td>
                              <td>${formatUgx(r.outstandingCredit)}</td>
                              ${canViewStock ? `<td>${Number(r.totalStockKgs || 0).toLocaleString()}</td>` : ""}
                              <td>${Number(r.salesCount || 0).toLocaleString()}</td>
                              <td>${Number(r.creditCount || 0).toLocaleString()}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan='${canViewStock ? "6" : "5"}'>No branch summary data found.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </section>
      `;
      container.innerHTML = options.hideSummaryTable ? cardsHtml : `${cardsHtml}${tableHtml}`;
    } catch (error) {
      console.error("Failed to load dashboard overview:", error);
      container.innerHTML = `<p>Failed to load dashboard overview: ${error?.message || "unknown error"}.</p>`;
    }
  }

  window.loadDashboardOverview = loadDashboardOverview;
})();



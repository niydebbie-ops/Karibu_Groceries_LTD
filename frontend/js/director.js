document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const currentUserName = String(localStorage.getItem("userName") || "").trim();

  if (!token || role !== "Director") {
    window.location.href = "login.html";
    return;
  }

  const PROTECTED_BRANCHES = new Set(["maganjo", "matugga"]);
  const COLOR_SALES = "#2f7f36";
  const COLOR_CREDIT = "#d97706";
  const COLOR_STOCK = "#2f7f36";
  const COLOR_RISK = "#b42318";
  const COLOR_NEUTRAL_BLUE = "#3b82f6";

  const contentArea = document.getElementById("contentArea");
  const pageTitle = document.getElementById("pageTitle");
  const sidebarLinks = Array.from(document.querySelectorAll(".sidebar-link"));
  const directorCharts = new Map();
  let pendingDeleteId = "";
  let pendingDeleteUntil = 0;

  function isProtectedOrban(user) {
    const name = String(user?.fullName || user?.name || "").toLowerCase();
    const email = String(user?.email || "").toLowerCase();
    return user?.role === "Director" && (name.includes("orban") || email.includes("orban"));
  }

  function isProtectedBranch(branch) {
    return PROTECTED_BRANCHES.has(String(branch?.name || "").trim().toLowerCase());
  }

  function formatBranchName(value) {
    const branch = String(value || "").trim().toLowerCase();
    if (branch === "maganjo") return "Maganjo";
    if (branch === "matugga") return "Matugga";
    return String(value || "");
  }

  function normalizeFullName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function isValidFullName(value) {
    const normalized = normalizeFullName(value);
    const parts = normalized.split(" ").filter(Boolean);
    if (parts.length < 2) return false;
    return parts.every((part) => /^[A-Za-z][A-Za-z.'-]{1,}$/.test(part));
  }

  function ensureToastContainer() {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = "info") {
    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast show ${type}`;
    toast.textContent = message;
    container.prepend(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  function showLogoutToast(message, type = "success") {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) {
      showToast(message, type);
      return;
    }
    let host = logoutBtn.nextElementSibling;
    if (!host || !host.classList.contains("sidebar-toast-host")) {
      host = document.createElement("div");
      host.className = "sidebar-toast-host";
      logoutBtn.insertAdjacentElement("afterend", host);
    }
    const toast = document.createElement("div");
    toast.className = `toast show ${type}`;
    toast.textContent = message;
    host.prepend(toast);
    setTimeout(() => {
      toast.remove();
      if (!host.children.length) host.remove();
    }, 2200);
  }

  async function apiFetch(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": options.body ? "application/json" : (options.headers?.["Content-Type"] || undefined)
      }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Request failed");
    }
    return data.data;
  }

  function setupSidebar() {
    const welcome = document.getElementById("welcomeUser");
    if (welcome) welcome.textContent = "Welcome, Mr. Orban";
    const directorChipName = document.querySelector("#directorUserChip .user-name");
    if (directorChipName) directorChipName.textContent = currentUserName || "Director";
  }

  function setActiveSidebar(target) {
    sidebarLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.target === target);
    });
  }

  function requireDeleteConfirmation(id, label = "record") {
    const now = Date.now();
    if (pendingDeleteId === id && now < pendingDeleteUntil) {
      pendingDeleteId = "";
      pendingDeleteUntil = 0;
      return true;
    }
    pendingDeleteId = id;
    pendingDeleteUntil = now + 3500;
    showToast(`Click Delete again within 3 seconds to confirm ${label} deletion.`, "info");
    return false;
  }

  function destroyDirectorChart(canvasId) {
    const chart = directorCharts.get(canvasId);
    if (chart) {
      chart.destroy();
      directorCharts.delete(canvasId);
    }
  }

  function renderDirectorChart(canvasId, config) {
    if (typeof Chart === "undefined") return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroyDirectorChart(canvasId);
    const chart = new Chart(canvas, config);
    directorCharts.set(canvasId, chart);
  }

  function formatUgx(value) {
    return `UGX ${Number(value || 0).toLocaleString()}`;
  }

  document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    sessionStorage.setItem("pendingToast", JSON.stringify({
      message: "Logged out successfully.",
      type: "success"
    }));
    localStorage.clear();
    showLogoutToast("Logged out successfully.", "success");
    setTimeout(() => (window.location.href = "login.html"), 1000);
  });

  async function loadSummary() {
    try {
      const [summary, reports] = await Promise.all([
        apiFetch("/api/reports/summary"),
        apiFetch("/api/reports")
      ]);

      const salesByBranch = Array.isArray(reports?.salesByBranch) ? reports.salesByBranch : [];
      const creditsByBranch = Array.isArray(reports?.creditsByBranch) ? reports.creditsByBranch : [];
      const stocksByBranch = Array.isArray(reports?.stocksByBranch) ? reports.stocksByBranch : [];
      const salesTodayByBranch = Array.isArray(reports?.salesTodayByBranch) ? reports.salesTodayByBranch : [];
      const creditsTodayByBranch = Array.isArray(reports?.creditsTodayByBranch) ? reports.creditsTodayByBranch : [];
      const branchSummary = Array.isArray(reports?.branchSummary) ? reports.branchSummary : [];

      const fallbackCreditMap = new Map(
        creditsByBranch.map((c) => [String(c.branchName || "").trim().toLowerCase(), Number(c.totalCredit || 0)])
      );
      const fallbackStockMap = new Map(
        stocksByBranch.map((s) => [String(s.branchName || "").trim().toLowerCase(), Number(s.totalStockKgs || 0)])
      );
      const fallbackSalesCountMap = new Map(
        salesTodayByBranch.map((s) => [String(s.branchName || "").trim().toLowerCase(), Number(s.salesRecordsToday || 0)])
      );
      const fallbackCreditCountMap = new Map(
        creditsTodayByBranch.map((c) => [String(c.branchName || "").trim().toLowerCase(), Number(c.creditRecordsToday || 0)])
      );

      const branchRows =
        branchSummary.length > 0
          ? branchSummary.map((row) => {
              const key = String(row.branchName || "").trim().toLowerCase();
              return {
                ...row,
                totalStockKgs: Number(
                  row.totalStockKgs !== undefined && row.totalStockKgs !== null
                    ? row.totalStockKgs
                    : fallbackStockMap.get(key) || 0
                ),
                salesRecordsCount: Number(
                  row.salesRecordsCount !== undefined && row.salesRecordsCount !== null
                    ? row.salesRecordsCount
                    : row.salesRecordsToday !== undefined && row.salesRecordsToday !== null
                      ? row.salesRecordsToday
                      : fallbackSalesCountMap.get(key) || 0
                ),
                creditRecordsCount: Number(
                  row.creditRecordsCount !== undefined && row.creditRecordsCount !== null
                    ? row.creditRecordsCount
                    : row.creditRecordsToday !== undefined && row.creditRecordsToday !== null
                      ? row.creditRecordsToday
                      : fallbackCreditCountMap.get(key) || 0
                )
              };
            })
          : Array.from(
              new Set([
                ...salesByBranch.map((s) => String(s.branchName || "").trim().toLowerCase()),
                ...creditsByBranch.map((c) => String(c.branchName || "").trim().toLowerCase()),
                ...stocksByBranch.map((s) => String(s.branchName || "").trim().toLowerCase())
              ])
            )
              .filter(Boolean)
              .map((key) => {
                const sales = salesByBranch.find((s) => String(s.branchName || "").trim().toLowerCase() === key) || {};
                return {
                  branchName: key,
                  totalAmount: Number(sales.totalAmount || 0),
                  totalTonnage: Number(sales.totalTonnage || 0),
                  totalCredit: Number(fallbackCreditMap.get(key) || 0),
                  totalStockKgs: Number(fallbackStockMap.get(key) || 0),
                  salesRecordsCount: 0,
                  creditRecordsCount: 0,
                  status: "Paid"
                };
              });

      const branchTotals = [...branchRows]
        .sort((a, b) => String(a.branchName || "").localeCompare(String(b.branchName || "")));

      contentArea.innerHTML = `
        <section class="card">
          <h2 class="overview-heading">Executive Overview</h2>
          <section class="overview-branch-card">
            <h3>Company Totals</h3>
            <div class="card-grid">
              <article class="metric-card metric-cash">
                <p class="metric-label">TOTAL CASH SALES</p>
                <p class="metric-value">UGX ${summary.totalSales.toLocaleString()}</p>
              </article>
              <article class="metric-card metric-credit">
                <p class="metric-label">OUTSTANDING CREDIT</p>
                <p class="metric-value">UGX ${summary.totalCredits.toLocaleString()}</p>
              </article>
              <article class="metric-card metric-stock">
                <p class="metric-label">TOTAL STOCK (KG)</p>
                <p class="metric-value">${summary.totalStocks.toLocaleString()}</p>
              </article>
            </div>
          </section>
          <section class="overview-branch-card">
            <h3>Director Analytics</h3>
            <div class="analytics-grid director-analytics-grid">
              <article class="card chart-card">
                <h3 class="chart-title">Sales Overview</h3>
                <div class="chart-wrap">
                  <canvas id="directorSalesOverviewChart"></canvas>
                </div>
              </article>
              <article class="card chart-card">
                <h3 class="chart-title">Credit Overview</h3>
                <div class="chart-wrap">
                  <canvas id="directorCreditOverviewChart"></canvas>
                </div>
              </article>
              <article class="card chart-card">
                <h3 class="chart-title">Total Stock Overview</h3>
                <div class="chart-wrap">
                  <canvas id="directorStockOverviewChart"></canvas>
                </div>
              </article>
            </div>
          </section>
        </section>
      `;

      const branchLabels = branchTotals.length
        ? branchTotals.map((row) => formatBranchName(row.branchName || "-"))
        : ["No data"];
      const salesTotals = branchTotals.length
        ? branchTotals.map((row) => Number(row.totalAmount || 0))
        : [0];
      const creditTotals = branchTotals.length
        ? branchTotals.map((row) => Number(row.totalCredit || 0))
        : [0];
      const stockTotals = branchTotals.length
        ? branchTotals.map((row) => Number(row.totalStockKgs || 0))
        : [0];
      const hasCreditData = creditTotals.some((value) => value > 0);

      renderDirectorChart("directorSalesOverviewChart", {
        type: "bar",
        data: {
          labels: branchLabels,
          datasets: [
            {
              label: "Sales (UGX)",
              data: salesTotals,
              backgroundColor: COLOR_SALES,
              borderRadius: 0,
              maxBarThickness: 54
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value) => Number(value || 0).toLocaleString() }
            }
          },
          plugins: {
            legend: { display: true, position: "top" },
            tooltip: {
              callbacks: { label: (ctx) => `Sales: ${formatUgx(ctx.raw)}` }
            }
          }
        }
      });

      renderDirectorChart("directorCreditOverviewChart", {
        type: "doughnut",
        data: {
          labels: hasCreditData ? branchLabels : ["No credit data"],
          datasets: [
            {
              data: hasCreditData ? creditTotals : [1],
              backgroundColor: hasCreditData
                ? ["#2f7f36", "#d97706", "#3b82f6", "#b42318", "#7c3aed", "#0ea5e9"]
                : ["#cbd5e1"],
              borderWidth: 2,
              borderColor: "#ffffff",
              hoverOffset: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "52%",
          plugins: {
            legend: { display: true, position: "top" },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (!hasCreditData) return "No credit data";
                  return `${ctx.label}: ${formatUgx(ctx.raw)}`;
                }
              }
            }
          }
        }
      });

      renderDirectorChart("directorStockOverviewChart", {
        type: "pie",
        data: {
          labels: branchLabels.map((name, idx) => `${name} (${Number(stockTotals[idx] || 0).toLocaleString()} kg)`),
          datasets: [
            {
              data: stockTotals,
              backgroundColor: ["#2f7f36", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#0ea5e9"],
              borderColor: "#ffffff",
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: "top" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${Number(ctx.raw || 0).toLocaleString()} kg`
              }
            }
          }
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function loadUsers() {
    try {
      const users = await apiFetch("/api/director/users");

      contentArea.innerHTML = `
        <section class="card">
          <h2>👥 Users Management</h2>
          <form id="userForm" class="form-modern">
            <input type="hidden" id="userId" />
            <input id="userName" placeholder="Full name" required />
            <input id="userEmail" type="email" placeholder="Email" required />
            <input id="userPassword" type="password" placeholder="Password (leave blank when updating)" />
            <select id="userRole" required>
              <option value="">Select role</option>
              <option value="Manager">Manager</option>
              <option value="SalesAgent">SalesAgent</option>
              <option value="Director">Director</option>
            </select>
            <button type="submit">Save User ✅</button>
          </form>
          <div class="table-scroll">
            <table class="table-modern" id="usersTable">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${users
                  .map((u) => {
                    const protectedOrban = isProtectedOrban(u);
                    const isActive = u.isActive !== false;
                    return `
                      <tr>
                        <td>${u.fullName || u.name}</td>
                        <td>${u.email}</td>
                        <td>${u.role}</td>
                        <td>${isActive ? "Active" : "Inactive"}</td>
                        <td>
                          <button class="edit-user" data-id="${u._id}" ${protectedOrban ? "disabled" : ""}>✏️ Edit</button>
                          <button class="toggle-user" data-id="${u._id}" data-next="${isActive ? "false" : "true"}" ${protectedOrban ? "disabled" : ""}>${isActive ? "⏸️ Deactivate" : "✅ Activate"}</button>
                          <button class="delete-user" data-id="${u._id}" ${protectedOrban ? "disabled" : ""}>Delete</button>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
      `;

      const userForm = document.getElementById("userForm");
      userForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("userId").value;
        const fullName = normalizeFullName(document.getElementById("userName").value);
        if (!isValidFullName(fullName)) {
          showToast("Enter full name (first and last name).", "error");
          return;
        }
        const payload = {
          fullName,
          email: document.getElementById("userEmail").value.trim(),
          role: document.getElementById("userRole").value
        };
        const password = document.getElementById("userPassword").value;
        if (!id || password.trim()) payload.password = password;

        try {
          if (id) {
            await apiFetch(`/api/director/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            showToast("User updated", "success");
          } else {
            await apiFetch("/api/director/users", { method: "POST", body: JSON.stringify(payload) });
            showToast("User created", "success");
          }
          loadUsers();
        } catch (err) {
          showToast(err.message, "error");
        }
      });

      const usersTable = document.getElementById("usersTable");
      usersTable.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains("delete-user")) {
          if (!requireDeleteConfirmation(id, "user")) return;
          try {
            await apiFetch(`/api/director/users/${id}`, { method: "DELETE" });
            showToast("User deleted successfully.", "success");
            loadUsers();
          } catch (err) {
            showToast(err.message, "error");
          }
          return;
        }

        if (e.target.classList.contains("toggle-user")) {
          const next = e.target.dataset.next === "true";
          try {
            await apiFetch(`/api/director/users/${id}/active`, {
              method: "PATCH",
              body: JSON.stringify({ isActive: next })
            });
            showToast(next ? "User activated" : "User deactivated", "success");
            loadUsers();
          } catch (err) {
            showToast(err.message, "error");
          }
          return;
        }

        if (e.target.classList.contains("edit-user")) {
          const row = e.target.closest("tr").children;
          document.getElementById("userId").value = id;
          document.getElementById("userName").value = row[0].textContent;
          document.getElementById("userEmail").value = row[1].textContent;
          document.getElementById("userRole").value = row[2].textContent;
          document.getElementById("userPassword").value = "";
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function loadBranches() {
    try {
      const [branches, users] = await Promise.all([
        apiFetch("/api/branches"),
        apiFetch("/api/director/users")
      ]);

      const assignableUsers = users.filter((u) => u.role !== "Director" && u.isActive !== false);

      contentArea.innerHTML = `
        <section class="card branches-panel">
          <h2>🏬 Branch Management</h2>
          <div class="branch-layout">
            <article class="branch-form-wrap">
              <h3 class="branch-subtitle">Create or Update Branch</h3>
              <form id="branchForm" class="form-modern">
                <input type="hidden" id="branchId" />
                <input id="branchName" placeholder="Branch name" required />
                <input id="branchLocation" placeholder="Branch location" required />
                <div class="branch-form-actions">
                  <button type="submit" id="branchSaveBtn">Save Branch</button>
                </div>
              </form>
            </article>

            <article class="branch-form-wrap">
              <h3 class="branch-subtitle">Assign User to Branch</h3>
              <form id="assignForm" class="form-modern">
                <select id="assignUser" required>
                  <option value="">Select user</option>
                  ${assignableUsers
                    .map((u) => `<option value="${u._id}">${u.fullName || u.name} (${u.role})</option>`)
                    .join("")}
                </select>
                <select id="assignBranch" required>
                  <option value="">Select branch</option>
                  ${branches.filter((b) => b.isActive !== false).map((b) => `<option value="${b._id}">${formatBranchName(b.name)}</option>`).join("")}
                </select>
                <button type="submit">Assign User</button>
              </form>
            </article>
          </div>

          <div class="table-scroll">
            <table class="table-modern" id="branchesTable">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Assigned Users</th>
                  <th>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                ${branches
                  .map((b) => {
                    const isActive = b.isActive !== false;
                    const usersText = (b.users || []).map((u) => `${u.fullName || u.name} (${u.role})`).join(", ") || "-";
                    return `
                      <tr>
                        <td><strong>${formatBranchName(b.name)}</strong></td>
                        <td>${b.location}</td>
                        <td><span class="branch-status ${isActive ? "is-active" : "is-inactive"}">${isActive ? "Active" : "Inactive"}</span></td>
                        <td>${usersText}</td>
                        <td>
                          <div class="branch-actions">
                            <button class="edit-branch edit-user" data-id="${b._id}" title="Edit branch name/location">✏️ Edit</button>
                            <button class="toggle-branch toggle-user" data-id="${b._id}" data-next="${isActive ? "false" : "true"}">${isActive ? "⏸️ Deactivate" : "✅ Activate"}</button>
                            <button class="delete-branch delete-user" data-id="${b._id}">Delete</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
      `;

      document.getElementById("branchForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("branchId").value;
        const payload = {
          name: document.getElementById("branchName").value.trim(),
          location: document.getElementById("branchLocation").value.trim()
        };
        try {
          if (id) {
            await apiFetch(`/api/branches/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            showToast("Branch updated", "success");
          } else {
            await apiFetch("/api/branches", { method: "POST", body: JSON.stringify(payload) });
            showToast("Branch created", "success");
          }
          loadBranches();
        } catch (err) {
          showToast(err.message, "error");
        }
      });

      document.getElementById("assignForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const userId = document.getElementById("assignUser").value;
        const branchId = document.getElementById("assignBranch").value;
        try {
          await apiFetch("/api/branches/assign", {
            method: "POST",
            body: JSON.stringify({ userId, branchId })
          });
          showToast("User assigned", "success");
          loadBranches();
        } catch (err) {
          const msg = String(err.message || "");
          if (msg.includes("already has a manager") || msg.includes("already has two sales agents")) {
            showToast(`${msg}. Tip: edit users in Users section, or move/remove existing branch users first.`, "error");
          } else {
            showToast(msg, "error");
          }
        }
      });

      document.getElementById("branchesTable").addEventListener("click", async (e) => {
        const button = e.target.closest("button[data-id]");
        if (!button) return;
        const id = button.dataset.id;
        if (!id) return;

        if (button.classList.contains("delete-branch")) {
          if (!requireDeleteConfirmation(id, "branch")) return;
          try {
            await apiFetch(`/api/branches/${id}`, { method: "DELETE" });
            showToast("Branch deleted successfully.", "success");
            loadBranches();
          } catch (err) {
            showToast(err.message, "error");
          }
          return;
        }

        if (button.classList.contains("toggle-branch")) {
          const next = button.dataset.next === "true";
          try {
            await apiFetch(`/api/branches/${id}/active`, {
              method: "PATCH",
              body: JSON.stringify({ isActive: next })
            });
            showToast(next ? "Branch activated" : "Branch deactivated", "success");
            loadBranches();
          } catch (err) {
            showToast(err.message, "error");
          }
          return;
        }

        if (button.classList.contains("edit-branch")) {
          const selected = branches.find((branch) => branch._id === id);
          if (!selected) return;
          document.getElementById("branchId").value = id;
          document.getElementById("branchName").value = formatBranchName(selected.name);
          document.getElementById("branchLocation").value = selected.location || "";
          document.getElementById("branchName").focus();
          showToast(`Editing ${formatBranchName(selected.name)}`, "info");
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.target;
      if (target === "summary") showToast("Opening Dashboard", "info");
      if (target === "users") showToast("Opening Users", "info");
      if (target === "branches") showToast("Opening Branches", "info");
      setActiveSidebar(target);
      if (pageTitle) pageTitle.textContent = target.charAt(0).toUpperCase() + target.slice(1);
      if (target === "summary") loadSummary();
      if (target === "users") loadUsers();
      if (target === "branches") loadBranches();
    });
  });

  setupSidebar();
  setActiveSidebar("summary");
  loadSummary();
});




document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const token = localStorage.getItem("token");
  const currentRole = localStorage.getItem("role") || "";
  const assignedBranch = (localStorage.getItem("branch") || "").trim().toLowerCase();
  const userName = localStorage.getItem("userName") || "";
  const isSalesDashboard = document.body.classList.contains("sales-dashboard");
  const isManagerDashboard = document.body.classList.contains("manager-dashboard");
  const validProduce = ["beans", "grain maize", "cow peas", "g-nuts", "soybeans"];
  const produceLabels = {
    beans: "Beans",
    "grain maize": "Grain Maize",
    "cow peas": "Cow peas",
    "g-nuts": "G-nuts",
    soybeans: "Soybeans"
  };
  const produceAliases = {
    beans: "beans",
    "grain maize": "grain maize",
    "grain-maize": "grain maize",
    maize: "grain maize",
    "maize grain": "grain maize",
    "cow peas": "cow peas",
    cowpeas: "cow peas",
    "cow-peas": "cow peas",
    "g nuts": "g-nuts",
    "g-nuts": "g-nuts",
    gnuts: "g-nuts",
    "ground nuts": "g-nuts",
    groundnuts: "g-nuts",
    soybeans: "soybeans",
    soybean: "soybeans",
    soyabeans: "soybeans",
    soyabean: "soybeans",
    "soy bean": "soybeans",
    "soy beans": "soybeans",
    "soya beans": "soybeans",
    "soya bean": "soybeans"
  };

  const salesTableBody = document.querySelector("#salesTable tbody");
  const salesMessage = document.getElementById("salesMessage");
  const salesForm = document.getElementById("salesForm");
  const saveButton = salesForm?.querySelector("button[type='submit']");
  const stockPriceByProduce = new Map();
  const pendingUnitPriceRequests = new Map();

  let editingSaleId = "";
  const salesById = new Map();
  let pendingDeleteId = "";
  let pendingDeleteUntil = 0;

  if (!salesTableBody || !salesForm) return;

  if (salesForm.sellerName) salesForm.sellerName.value = userName;
  if (salesForm.branch) salesForm.branch.value = assignedBranch ? formatBranchName(assignedBranch) : "";

  const tonnageField = salesForm.tonnage;
  const amountPaidField = salesForm.amountPaid;
  const produceField = salesForm.produceName;
  const unitPriceHint = document.getElementById("saleUnitPriceHint");

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
    setTimeout(() => toast.remove(), 3000);
  }

  function setMessage(msg, type = "info") {
    if (salesMessage) salesMessage.textContent = msg;
    if (msg) showToast(msg, type);
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

  function initProduceField() {
    const field = salesForm.produceName;
    if (!field || field.tagName !== "SELECT") return;

    field.innerHTML = "";
    validProduce.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = produceLabels[item] || item;
      field.appendChild(option);
    });
  }

  function normalizeItemName(value) {
    const key = String(value || "")
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return produceAliases[key] || key;
  }

  function displayProduceName(value) {
    return produceLabels[normalizeItemName(value)] || String(value || "");
  }

  function formatBranchName(value) {
    const branch = String(value || "").trim().toLowerCase();
    if (branch === "maganjo") return "Maganjo";
    if (branch === "matugga") return "Matugga";
    return String(value || "");
  }

  function formatDisplayDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function formatDateForField(value) {
    return formatDisplayDate(value);
  }

  function toIsoFromFieldDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const dotted = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotted) {
      const day = Number(dotted[1]);
      const month = Number(dotted[2]);
      const year = Number(dotted[3]);
      const date = new Date(year, month - 1, day);
      if (
        Number.isFinite(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date.toISOString();
      }
      return "";
    }

    const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLike) return new Date(`${raw}T00:00:00`).toISOString();

    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
  }

  function normalizePersonName(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function isRecordedByCurrentUser(sale) {
    if (isSalesDashboard && currentRole !== "SalesAgent") return false;
    if (isManagerDashboard && currentRole !== "Manager") return false;

    const sellerName = sale?.agentName || sale?.salesAgentName || "";
    const seller = normalizePersonName(sellerName);
    const current = normalizePersonName(userName);
    if (!seller || !current) return false;
    if (seller === current) return true;
    const sellerParts = seller.split(" ").filter(Boolean);
    const currentParts = current.split(" ").filter(Boolean);
    return sellerParts.length === 1 && currentParts.includes(sellerParts[0]);
  }

  function getCurrentUnitPrice() {
    const produceKey = normalizeItemName(produceField?.value || "");
    return Number(stockPriceByProduce.get(produceKey) || 0);
  }

  async function fetchUnitPriceForProduce(produceValue) {
    const produceKey = normalizeItemName(produceValue);
    if (!produceKey) return 0;

    const cached = Number(stockPriceByProduce.get(produceKey) || 0);
    if (cached > 0) return cached;

    if (pendingUnitPriceRequests.has(produceKey)) {
      return pendingUnitPriceRequests.get(produceKey);
    }

    const request = (async () => {
      try {
        const url = `${API_BASE}/api/sales/unit-price?produceName=${encodeURIComponent(produceKey)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          const message = String(data?.message || "").toLowerCase();
          if (unitPriceHint && res.status === 404 && (!message || message.includes("cannot get"))) {
            unitPriceHint.textContent = "Backend update not active yet. Restart backend server.";
            unitPriceHint.classList.add("price-error");
          }
          return 0;
        }

        const unitPrice = Number(data?.data?.unitPrice || 0);
        if (unitPrice > 0) stockPriceByProduce.set(produceKey, unitPrice);
        return unitPrice > 0 ? unitPrice : 0;
      } catch (_) {
        return 0;
      } finally {
        pendingUnitPriceRequests.delete(produceKey);
      }
    })();

    pendingUnitPriceRequests.set(produceKey, request);
    return request;
  }

  async function updateAmountPaidAuto() {
    if (!tonnageField || !amountPaidField || !produceField) return;
    const tonnage = Number(tonnageField.value);
    const produceName = String(produceField.value || "").trim();
    let unitPrice = getCurrentUnitPrice();
    if (produceName && unitPrice <= 0) {
      unitPrice = await fetchUnitPriceForProduce(produceName);
    }
    const shouldAutoFill = Number.isFinite(tonnage) && tonnage > 0 && unitPrice > 0;

    amountPaidField.readOnly = shouldAutoFill;
    if (shouldAutoFill) {
      amountPaidField.value = String(tonnage * unitPrice);
      amountPaidField.title = `Auto: ${unitPrice.toLocaleString()} UGX per KG`;
      if (unitPriceHint) {
        unitPriceHint.textContent = `Price: ${unitPrice.toLocaleString()} UGX per KG | Auto amount: ${(tonnage * unitPrice).toLocaleString()} UGX`;
        unitPriceHint.classList.remove("price-error");
      }
    } else {
      amountPaidField.title = "";
      if (unitPriceHint) {
        if (produceName && unitPrice <= 0) {
          unitPriceHint.textContent = "No selling price found for this produce in current stock.";
          unitPriceHint.classList.add("price-error");
        } else {
          unitPriceHint.textContent = "Amount will auto-calculate when produce price and tonnage are available.";
          unitPriceHint.classList.remove("price-error");
        }
      }
    }
  }

  async function loadStockPrices() {
    try {
      const res = await fetch(`${API_BASE}/api/stock`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      stockPriceByProduce.clear();
      if (!res.ok || !data.success || !Array.isArray(data.data)) {
        if (unitPriceHint) {
          unitPriceHint.textContent = "Could not load produce prices. Check login/session and backend status.";
          unitPriceHint.classList.add("price-error");
        }
        return;
      }

      data.data.forEach((stock) => {
        const key = normalizeItemName(stock.itemName ?? stock.produceName ?? "");
        const sellingPrice = Number(stock.sellingPrice);
        if (key && Number.isFinite(sellingPrice) && sellingPrice > 0) {
          stockPriceByProduce.set(key, sellingPrice);
        }
      });

      updateAmountPaidAuto();
    } catch (err) {
      console.error("Failed to load stock prices:", err);
      if (unitPriceHint) {
        unitPriceHint.textContent = "Could not load produce prices. Check backend connection.";
        unitPriceHint.classList.add("price-error");
      }
    }
  }

  function resetForm() {
    salesForm.reset();
    editingSaleId = "";
    if (salesForm.sellerName) salesForm.sellerName.value = userName;
    if (salesForm.branch) salesForm.branch.value = assignedBranch ? formatBranchName(assignedBranch) : "";
    if (salesForm.saleDate) salesForm.saleDate.value = formatDateForField(new Date());
    if (salesForm.saleTime) salesForm.saleTime.value = new Date().toLocaleTimeString();
    if (amountPaidField) amountPaidField.readOnly = false;
    if (unitPriceHint) {
      unitPriceHint.textContent = "Amount will auto-calculate when produce price and tonnage are available.";
      unitPriceHint.classList.remove("price-error");
    }
    if (saveButton) saveButton.textContent = "Save Sale";
    updateAmountPaidAuto();
  }

  async function loadSales() {
    try {
      await loadStockPrices();
      const res = await fetch(`${API_BASE}/api/sales`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const apiMessage = String(data?.message || "").trim();
        const message = apiMessage || `Failed to load sales (HTTP ${res.status}).`;
        setMessage(message, "error");
        salesTableBody.innerHTML = "<tr><td colspan='9'>Failed to load sales. Please login again.</td></tr>";
        return;
      }

      salesTableBody.innerHTML = "";
      salesById.clear();

      if (!Array.isArray(data.data) || data.data.length === 0) {
        salesTableBody.innerHTML = "<tr><td colspan='9'>No sales records</td></tr>";
        return;
      }

      data.data.forEach((sale) => {
        const normalizedSale = {
          ...sale,
          itemName: normalizeItemName(sale.itemName),
          canManageLocal: isRecordedByCurrentUser(sale)
        };
        salesById.set(normalizedSale._id, normalizedSale);
        const actionsHtml = normalizedSale.canManageLocal
          ? `
            <button class="updateBtn" data-id="${normalizedSale._id}">Update</button>
            <button class="deleteBtn" data-id="${normalizedSale._id}">Delete</button>
          `
          : "<span>-</span>";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${displayProduceName(normalizedSale.itemName)}</td>
          <td>${normalizedSale.tonnage}</td>
          <td>${normalizedSale.amountPaid}</td>
          <td>${normalizedSale.buyerName}</td>
          <td>${normalizedSale.agentName}</td>
          <td>${formatBranchName(normalizedSale.branch)}</td>
          <td>${formatDisplayDate(normalizedSale.date)}</td>
          <td>${normalizedSale.time || "-"}</td>
          <td>${actionsHtml}</td>
        `;
        salesTableBody.appendChild(row);
      });
    } catch (err) {
      console.error("Failed to load sales:", err);
      salesTableBody.innerHTML = "<tr><td colspan='9'>Error loading sales</td></tr>";
    }
  }

  salesTableBody.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    const sale = salesById.get(id);
    if (!sale) return;
    if (!sale.canManageLocal) {
      setMessage("You can only update or delete sales that you recorded.", "error");
      return;
    }

    if (e.target.classList.contains("updateBtn")) {
      editingSaleId = id;
      salesForm.produceName.value = sale.itemName;
      salesForm.tonnage.value = sale.tonnage;
      salesForm.amountPaid.value = sale.amountPaid;
      salesForm.buyerName.value = sale.buyerName;
      if (salesForm.sellerName) salesForm.sellerName.value = userName;
      if (salesForm.branch) salesForm.branch.value = formatBranchName(assignedBranch);
      if (salesForm.saleDate) salesForm.saleDate.value = formatDateForField(sale.date);
      if (salesForm.saleTime) salesForm.saleTime.value = sale.time || new Date().toLocaleTimeString();
      if (saveButton) saveButton.textContent = "Update Sale";
      await updateAmountPaidAuto();
      setMessage("Sale loaded. Edit fields and submit to update.", "info");
      return;
    }

    if (!e.target.classList.contains("deleteBtn")) return;
    if (!requireDeleteConfirmation(id, "sale")) return;

    try {
      const res = await fetch(`${API_BASE}/api/sales/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || "Failed to delete sale.", "error");
        return;
      }
      if (editingSaleId === id) resetForm();
      setMessage("Sale deleted successfully.", "success");
      loadSales();
    } catch (err) {
      console.error("Failed to delete sale:", err);
      setMessage("Error deleting sale.", "error");
    }
  });

  salesForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const produceName = String(salesForm.produceName.value || "").trim().toLowerCase();
    const tonnage = Number(salesForm.tonnage.value);
    let unitPrice = getCurrentUnitPrice();
    if (produceName && unitPrice <= 0) {
      unitPrice = await fetchUnitPriceForProduce(produceName);
    }
    const autoAmount = Number.isFinite(tonnage) && tonnage > 0 && unitPrice > 0 ? tonnage * unitPrice : null;

    const payload = {
      produceName,
      tonnage,
      amountPaid: autoAmount ?? Number(salesForm.amountPaid.value),
      buyerName: String(salesForm.buyerName.value || "").trim(),
      sellerName: userName,
      branch: String(assignedBranch || "").trim().toLowerCase(),
      date: toIsoFromFieldDate(salesForm.saleDate?.value) || new Date().toISOString(),
      time: salesForm.saleTime?.value || new Date().toLocaleTimeString()
    };

    const url = editingSaleId ? `${API_BASE}/api/sales/${editingSaleId}` : `${API_BASE}/api/sales`;
    const method = editingSaleId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        const message =
          data.message || (data.errors ? data.errors.map((er) => er.msg).join(", ") : "Failed to save sale.");
        setMessage(message, "error");
        return;
      }

      const notify = data.notification || (editingSaleId ? "Sale updated successfully." : "Sale recorded successfully.");
      setMessage(notify, "success");
      resetForm();
      loadSales();
    } catch (err) {
      console.error("Error saving sale:", err);
      setMessage("Error saving sale.", "error");
    }
  });

  initProduceField();
  tonnageField?.addEventListener("input", updateAmountPaidAuto);
  produceField?.addEventListener("input", updateAmountPaidAuto);
  produceField?.addEventListener("change", updateAmountPaidAuto);
  resetForm();
  loadSales();
  window.loadSales = loadSales;
});





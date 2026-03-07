document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const token = localStorage.getItem("token");
  const assignedBranch = (localStorage.getItem("branch") || "").trim().toLowerCase();

  const form = document.getElementById("stockForm");
  const tableBody = document.querySelector("#stockTable tbody");
  const idField = document.getElementById("stockId");
  const stockMessage = document.getElementById("stockMessage");

  const itemField = document.getElementById("stockItemName");
  const unitField = document.getElementById("stockUnit");
  const quantityField = document.getElementById("stockQuantity");
  const branchField = document.getElementById("stockBranch");
  const submitButton = form?.querySelector("button[type='submit']");

  const stockById = new Map();
  let pendingDeleteId = "";
  let pendingDeleteUntil = 0;

  if (!tableBody) return;

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

  function setMessage(message, type = "info") {
    if (stockMessage) stockMessage.textContent = message;
    if (message) showToast(message, type);
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

  function formatBranchName(value) {
    const branch = String(value || "").trim().toLowerCase();
    if (branch === "maganjo") return "Maganjo";
    if (branch === "matugga") return "Matugga";
    return String(value || "");
  }

  function initFields() {
    if (branchField && assignedBranch) {
      branchField.value = formatBranchName(assignedBranch);
      branchField.readOnly = true;
    }
  }

  function resetForm() {
    if (!form) return;
    form.reset();
    if (idField) idField.value = "";
    if (submitButton) submitButton.textContent = "Save Stock";
    if (branchField && assignedBranch) branchField.value = formatBranchName(assignedBranch);
  }

  function getStatusBadge(stockItem) {
    const quantity = Number(stockItem?.quantity ?? stockItem?.tonnageKgs ?? 0);
    const status = String(stockItem?.status || "")
      .trim()
      .toLowerCase();

    if (quantity <= 0 || status === "out of stock" || status === "out_of_stock") {
      return "<span class='badge-out'>Out of Stock</span>";
    }
    if (status === "ok") {
      return "<span class='badge-ok'>OK</span>";
    }
    return "<span class='badge-low'>Low Stock</span>";
  }

  function normalizeProduceKey(value) {
    const key = String(value || "")
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (key === "maize" || key === "maize grain") return "grain maize";
    if (key === "cowpeas") return "cow peas";
    if (key === "g nuts" || key === "gnuts" || key === "ground nuts") return "g-nuts";
    if (key === "soybean" || key === "soy bean" || key === "soy beans" || key === "soya bean" || key === "soya beans") {
      return "soybeans";
    }
    return key;
  }

  async function loadStock() {
    try {
      const res = await fetch(`${API_BASE}/api/stock`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const apiMessage = String(data?.message || "").trim();
        const message = apiMessage || `Failed to load stock (HTTP ${res.status}).`;
        setMessage(message, "error");
        tableBody.innerHTML = "<tr><td colspan='6'>Failed to load stock. Please login again.</td></tr>";
        return;
      }

      tableBody.innerHTML = "";
      stockById.clear();
      if (!Array.isArray(data.data) || data.data.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='6'>No stock records</td></tr>";
        return;
      }

      const mergedByProduce = new Map();
      (data.data || []).forEach((s) => {
        const key = normalizeProduceKey(s.produceName ?? s.itemName ?? "");
        if (!key) return;
        const qty = Number(s.quantity ?? s.tonnageKgs ?? 0);
        if (!mergedByProduce.has(key)) {
          mergedByProduce.set(key, {
            ...s,
            produceName: key,
            quantity: Number.isFinite(qty) ? qty : 0,
            tonnageKgs: Number.isFinite(qty) ? qty : 0
          });
          return;
        }
        const current = mergedByProduce.get(key);
        const nextQty = Number(current.quantity ?? current.tonnageKgs ?? 0) + (Number.isFinite(qty) ? qty : 0);
        current.quantity = nextQty;
        current.tonnageKgs = nextQty;
        if (Number(s.sellingPrice || 0) > Number(current.sellingPrice || 0)) {
          current.sellingPrice = Number(s.sellingPrice || 0);
        }
      });

      Array.from(mergedByProduce.values()).forEach((s) => {
        stockById.set(s._id, s);
        const produceName = s.produceName ?? s.itemName ?? "";
        const quantity = s.quantity ?? s.tonnageKgs ?? "";
        const branch = s.branch ?? s.branchName ?? "";
        const row = document.createElement("tr");
        const statusBadge = getStatusBadge(s);

        row.innerHTML = `
          <td>${produceName}</td>
          <td>${s.unit}</td>
          <td>${quantity}</td>
          <td>${formatBranchName(branch)}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-update" data-id="${s._id}">Update</button>
            <button class="btn-delete" data-id="${s._id}">Delete</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    } catch (err) {
      console.error("Error loading stock:", err);
      tableBody.innerHTML = "<tr><td colspan='6'>Error loading stock</td></tr>";
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = idField?.value || "";
    const payload = {
      produceName: String(itemField?.value || "").trim().toLowerCase(),
      unit: String(unitField?.value || "").trim(),
      quantity: parseInt(quantityField?.value || "0", 10),
      branch: String(branchField?.value || assignedBranch || "").trim().toLowerCase()
    };

    if (!payload.produceName) {
      setMessage("Please enter a valid produce item.", "error");
      return;
    }
    if (!payload.unit) {
      setMessage("Unit is required.", "error");
      return;
    }
    if (!Number.isFinite(payload.quantity) || payload.quantity < 0) {
      setMessage("Quantity must be 0 or greater.", "error");
      return;
    }

    const url = id ? `${API_BASE}/api/stock/${id}` : `${API_BASE}/api/stock`;
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        const message =
          data.message || (data.errors ? data.errors.map((er) => er.msg).join(", ") : "Failed to save stock.");
        setMessage(message, "error");
        return;
      }
      setMessage(id ? "Stock updated successfully." : "Stock added successfully.", "success");
      resetForm();
      loadStock();
    } catch (err) {
      console.error("Error saving stock:", err);
      setMessage("Error saving stock.", "error");
    }
  });

  tableBody.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    const stock = stockById.get(id);
    if (!stock) return;

    if (e.target.classList.contains("btn-update")) {
      if (!form || !itemField || !unitField || !quantityField || !branchField) {
        setMessage("Stock form is missing on this page, update is unavailable.", "error");
        return;
      }
      idField.value = id;
      itemField.value = stock.produceName ?? stock.itemName ?? "";
      unitField.value = stock.unit;
      quantityField.value = stock.quantity ?? stock.tonnageKgs ?? "";
      branchField.value = formatBranchName(stock.branch ?? stock.branchName ?? "");
      if (submitButton) submitButton.textContent = "Update Stock";
      setMessage("Stock loaded. Edit fields and submit to update.", "info");
      return;
    }

    if (!e.target.classList.contains("btn-delete")) return;
    if (!requireDeleteConfirmation(id, "stock record")) return;

    try {
      const res = await fetch(`${API_BASE}/api/stock/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || "Failed to delete stock.", "error");
        return;
      }
      if (idField?.value === id) resetForm();
      setMessage("Stock deleted successfully.", "success");
      loadStock();
    } catch (err) {
      console.error("Error deleting stock:", err);
      setMessage("Error deleting stock.", "error");
    }
  });

  initFields();
  resetForm();
  loadStock();
  window.loadStock = loadStock;
});



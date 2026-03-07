document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const token = localStorage.getItem("token");
  const assignedBranch = (localStorage.getItem("branch") || "").trim().toLowerCase();
  const managerName = String(localStorage.getItem("userName") || "").trim();
  const validProduce = ["beans", "grain maize", "cow peas", "g-nuts", "soybeans"];
  const produceTypeByItem = {
    beans: "Legume",
    "grain maize": "Cereal",
    "cow peas": "Legume",
    "g-nuts": "Legume",
    soybeans: "Legume"
  };

  const form = document.getElementById("procForm");
  const tableBody = document.querySelector("#procTable tbody");
  const idField = document.getElementById("procId");
  const branchField = document.getElementById("branch");
  const dealerNameField = document.getElementById("dealerName");
  const procDateField = document.getElementById("procDate");
  const procTimeField = document.getElementById("procTime");
  const procMessage = document.getElementById("procMessage");
  const costHint = document.getElementById("procCostHint");
  const sellingHint = document.getElementById("procSellingHint");
  const produceField = form.produceName;
  const tonnageField = form.tonnage;
  const costField = form.costUgx;
  const sellingPriceField = form.sellingPriceUgx;
  const costRateByProduce = new Map();
  const sellingRateByProduce = new Map();
  const pendingSellingPriceRequests = new Map();
  let pendingDeleteId = "";
  let pendingDeleteUntil = 0;

  if (!form || !tableBody) return;

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
    if (procMessage) procMessage.textContent = message;
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

  function initProduceField() {
    const typeField = form.produceType;
    if (produceField && produceField.tagName === "SELECT") {
      produceField.innerHTML = "<option value=''>Select produce</option>";
      validProduce.forEach((item) => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        produceField.appendChild(option);
      });
    }

    produceField?.addEventListener("change", () => {
      if (!typeField) return;
      const key = String(produceField.value || "").trim().toLowerCase().replace(/\s+/g, " ");
      typeField.value = produceTypeByItem[key] || "";
    });
  }

  function setProcurementDateTime() {
    const now = new Date();
    if (procDateField) procDateField.value = now.toISOString().slice(0, 10);
    if (procTimeField) procTimeField.value = now.toLocaleTimeString();
  }

  function resetForm() {
    form.reset();
    idField.value = "";
    if (branchField) {
      branchField.value = ["maganjo", "matugga"].includes(assignedBranch) ? formatBranchName(assignedBranch) : "";
    }
    if (dealerNameField) {
      dealerNameField.value = managerName;
      dealerNameField.readOnly = true;
    }
    if (costField) costField.readOnly = false;
    if (sellingPriceField) sellingPriceField.readOnly = false;
    if (costHint) {
      costHint.textContent = "Cost will auto-calculate when produce unit cost and tonnage are available.";
      costHint.classList.remove("price-error");
    }
    if (sellingHint) {
      sellingHint.textContent = "Selling price will auto-calculate when produce data is available.";
      sellingHint.classList.remove("price-error");
    }
    setProcurementDateTime();
    updateCostAuto();
    updateSellingPriceAuto();
  }

  function normalizeItemName(value) {
    const key = String(value || "")
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (key === "maize") return "grain maize";
    if (key === "maize grain") return "grain maize";
    if (key === "cowpeas") return "cow peas";
    if (key === "ground nuts" || key === "gnuts" || key === "g nuts") return "g-nuts";
    if (key === "soybean" || key === "soy bean" || key === "soy beans" || key === "soya bean" || key === "soya beans") {
      return "soybeans";
    }
    return key;
  }

  function getCurrentCostRate() {
    const produceKey = normalizeItemName(produceField?.value || "");
    return Number(costRateByProduce.get(produceKey) || 0);
  }

  function getCurrentSellingRate() {
    const produceKey = normalizeItemName(produceField?.value || "");
    return Number(sellingRateByProduce.get(produceKey) || 0);
  }

  async function fetchSellingRateForProduce(produceValue) {
    const produceKey = normalizeItemName(produceValue);
    if (!produceKey) return 0;

    const cached = Number(sellingRateByProduce.get(produceKey) || 0);
    if (cached > 0) return cached;
    if (pendingSellingPriceRequests.has(produceKey)) return pendingSellingPriceRequests.get(produceKey);

    const request = (async () => {
      try {
        const url = `${API_BASE}/api/sales/unit-price?produceName=${encodeURIComponent(produceKey)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return 0;
        const unitPrice = Number(data?.data?.unitPrice || 0);
        if (unitPrice > 0) sellingRateByProduce.set(produceKey, unitPrice);
        return unitPrice > 0 ? unitPrice : 0;
      } catch (_) {
        return 0;
      } finally {
        pendingSellingPriceRequests.delete(produceKey);
      }
    })();

    pendingSellingPriceRequests.set(produceKey, request);
    return request;
  }

  async function updateCostAuto() {
    if (!produceField || !tonnageField || !costField) return;
    const produceName = String(produceField.value || "").trim();
    const tonnage = Number(tonnageField.value);
    let unitCost = getCurrentCostRate();
    let source = "history";
    if (!(unitCost > 0) && produceName) {
      unitCost = await fetchSellingRateForProduce(produceName);
      source = "selling";
    }
    const shouldAutoFill = produceName && Number.isFinite(tonnage) && tonnage > 0 && unitCost > 0;

    costField.readOnly = shouldAutoFill;
    if (shouldAutoFill) {
      const totalCost = Math.round(tonnage * unitCost);
      costField.value = String(totalCost);
      if (costHint) {
        costHint.textContent =
          source === "history"
            ? `Cost rate: ${Math.round(unitCost).toLocaleString()} UGX per KG | Auto cost: ${totalCost.toLocaleString()} UGX`
            : `Estimated from selling price: ${Math.round(unitCost).toLocaleString()} UGX per KG | Auto cost: ${totalCost.toLocaleString()} UGX`;
        costHint.classList.remove("price-error");
      }
    } else if (costHint) {
      if (produceName) {
        costHint.textContent = "No previous cost or selling rate found for this produce.";
        costHint.classList.add("price-error");
      } else {
        costHint.textContent = "Cost will auto-calculate when produce unit cost and tonnage are available.";
        costHint.classList.remove("price-error");
      }
    }
  }

  async function updateSellingPriceAuto() {
    if (!sellingPriceField || !produceField || !tonnageField || !costField) return;
    const produceName = String(produceField.value || "").trim();
    const tonnage = Number(tonnageField.value);
    const totalCost = Number(costField.value);

    let unitSelling = getCurrentSellingRate();
    let source = "history";
    if (!(unitSelling > 0) && produceName) {
      unitSelling = await fetchSellingRateForProduce(produceName);
      source = "api";
    }
    if (!(unitSelling > 0) && Number.isFinite(totalCost) && totalCost > 0 && Number.isFinite(tonnage) && tonnage > 0) {
      unitSelling = Math.ceil(totalCost / tonnage);
      source = "cost";
    }

    const shouldAutoFill = produceName && Number.isFinite(unitSelling) && unitSelling > 0;
    sellingPriceField.readOnly = shouldAutoFill;
    if (shouldAutoFill) {
      const display = Math.round(unitSelling);
      sellingPriceField.value = String(display);
      if (sellingHint) {
        if (source === "history" || source === "api") {
          sellingHint.textContent = `Auto selling price: ${display.toLocaleString()} UGX per KG`;
        } else {
          sellingHint.textContent = `Estimated from cost/tonnage: ${display.toLocaleString()} UGX per KG`;
        }
        sellingHint.classList.remove("price-error");
      }
    } else if (sellingHint) {
      if (produceName) {
        sellingHint.textContent = "No selling price found for this produce yet.";
        sellingHint.classList.add("price-error");
      } else {
        sellingHint.textContent = "Selling price will auto-calculate when produce data is available.";
        sellingHint.classList.remove("price-error");
      }
    }
  }

  function getBranchValue() {
    if (["maganjo", "matugga"].includes(assignedBranch)) return assignedBranch;
    return (branchField?.value || "").trim().toLowerCase();
  }

  function isValidUgPhone(phone) {
    return /^(\+256|0)7\d{8}$/.test(String(phone || "").trim());
  }

  async function loadProcurement() {
    try {
      const res = await fetch(`${API_BASE}/api/procurement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const apiMessage = String(data?.message || "").trim();
        const message = apiMessage || `Failed to load procurement (HTTP ${res.status}).`;
        setMessage(message, "error");
        tableBody.innerHTML = "<tr><td colspan='11'>Failed to load procurement data. Please login again.</td></tr>";
        return;
      }

      tableBody.innerHTML = "";
      costRateByProduce.clear();
      if (!Array.isArray(data.data) || data.data.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='11'>No records</td></tr>";
    updateCostAuto();
        return;
      }

      data.data.forEach((p) => {
        const produceName = p.produceName ?? p.itemName ?? "";
        const produceKey = normalizeItemName(produceName);
        const tonnageNum = Number(p.tonnage ?? p.tonnageKgs ?? 0);
        const costNum = Number(p.costUgx ?? 0);
        if (produceKey && tonnageNum > 0 && costNum > 0 && !costRateByProduce.has(produceKey)) {
          costRateByProduce.set(produceKey, costNum / tonnageNum);
        }
        const produceType = p.produceType ?? p.type ?? "-";
        const dateValue = p.date ?? p.procurementDate;
        const timeValue = p.time ?? p.procurementTime ?? "-";
        const tonnageValue = p.tonnage ?? p.tonnageKgs ?? "";
        const branchValue = p.branch ?? p.branchName ?? "";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${produceName}</td>
          <td>${produceType}</td>
          <td>${dateValue ? new Date(dateValue).toLocaleDateString() : "-"}</td>
          <td>${timeValue}</td>
          <td>${tonnageValue}</td>
          <td>${p.costUgx}</td>
          <td>${p.dealerName}</td>
          <td>${p.dealerContact || "-"}</td>
          <td>${p.sellingPriceUgx || 0}</td>
          <td>${formatBranchName(branchValue)}</td>
          <td>
            <button class="btn-update" data-id="${p._id}">Update</button>
            <button class="btn-delete" data-id="${p._id}">Delete</button>
          </td>
        `;
      tableBody.appendChild(row);
    });
      updateCostAuto();
      updateSellingPriceAuto();
    } catch (err) {
      console.error("Error loading procurement:", err);
      setMessage("Error loading procurement records.", "error");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = idField.value;
    const branchValue = getBranchValue();

    if (!["maganjo", "matugga"].includes(branchValue)) {
      setMessage("Branch name is missing. Logout and login after Director assigns your branch.", "error");
      return;
    }
    if (!isValidUgPhone(form.dealerContact.value)) {
      setMessage("Dealer contact must be 07XXXXXXXX or +2567XXXXXXXX.", "error");
      return;
    }
    if (parseInt(form.tonnage.value, 10) < 1000) {
      setMessage("Tonnage must be at least 1000KG.", "error");
      return;
    }
    if (parseFloat(form.costUgx.value) < 10000) {
      setMessage("Cost in UGX must be at least 10,000.", "error");
      return;
    }
    if (parseFloat(form.sellingPriceUgx.value) < 10000) {
      setMessage("Selling price in UGX must be at least 10,000.", "error");
      return;
    }

    const proc = {
      produceName: String(form.produceName.value || "").trim().toLowerCase(),
      produceType: String(form.produceType.value || "").trim(),
      tonnage: Number(form.tonnage.value),
      costUgx:
        Number(form.tonnage.value) > 0 && getCurrentCostRate() > 0
          ? Math.round(Number(form.tonnage.value) * getCurrentCostRate())
          : Number(form.costUgx.value),
      dealerName: String(form.dealerName.value || "").trim(),
      dealerContact: String(form.dealerContact.value || "").trim(),
      sellingPriceUgx: Number(form.sellingPriceUgx.value),
      branch: branchValue,
      date: procDateField?.value || new Date().toISOString().slice(0, 10),
      time: procTimeField?.value || new Date().toLocaleTimeString()
    };

    const url = id ? `${API_BASE}/api/procurement/${id}` : `${API_BASE}/api/procurement`;
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(proc)
      });
      const data = await res.json();

      if (!data.success) {
        const validationErrors = Array.isArray(data.errors) ? data.errors.map((er) => er.msg).join(", ") : "";
        setMessage(validationErrors || data.message || "Failed to save procurement.", "error");
        return;
      }

      setMessage(id ? "Procurement updated successfully." : "Procurement saved successfully.", "success");
      resetForm();
      loadProcurement();
      if (typeof window.loadStock === "function") window.loadStock();
    } catch (err) {
      console.error("Error saving procurement:", err);
      setMessage("Error saving procurement.", "error");
    }
  });

  tableBody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-update")) {
      const id = e.target.dataset.id;
      const row = e.target.closest("tr");
      const cells = row.querySelectorAll("td");

      idField.value = id;
      form.produceName.value = cells[0].textContent.trim().toLowerCase();
      form.produceType.value = cells[1].textContent.trim();
      form.tonnage.value = cells[4].textContent.trim();
      form.costUgx.value = cells[5].textContent.trim();
      form.dealerName.value = managerName;
      form.dealerContact.value = cells[7].textContent.trim();
      form.sellingPriceUgx.value = cells[8].textContent.trim();
      await updateCostAuto();
      await updateSellingPriceAuto();
      setMessage("Procurement loaded. Edit fields and submit to update.", "info");
      return;
    }

    if (!e.target.classList.contains("btn-delete")) return;
    const id = e.target.dataset.id;
    if (!requireDeleteConfirmation(id, "procurement record")) return;

    try {
      const res = await fetch(`${API_BASE}/api/procurement/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || "Failed to delete procurement.", "error");
        return;
      }
      if (idField.value === id) resetForm();
      setMessage("Procurement deleted successfully.", "success");
      loadProcurement();
    } catch (err) {
      console.error("Error deleting procurement:", err);
      setMessage("Error deleting procurement.", "error");
    }
  });

  initProduceField();
  tonnageField?.addEventListener("input", () => {
    updateCostAuto();
    updateSellingPriceAuto();
  });
  costField?.addEventListener("input", updateSellingPriceAuto);
  produceField?.addEventListener("input", () => {
    updateCostAuto();
    updateSellingPriceAuto();
  });
  produceField?.addEventListener("change", () => {
    updateCostAuto();
    updateSellingPriceAuto();
  });
  resetForm();
  loadProcurement();
  window.loadProcurement = loadProcurement;
});



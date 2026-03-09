document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const token = localStorage.getItem("token");
  const assignedBranch = (localStorage.getItem("branch") || "").trim().toLowerCase();
  const userName = localStorage.getItem("userName") || "";

  const creditTableBody = document.querySelector("#creditTable tbody");
  const creditMessage = document.getElementById("creditMessage");
  const creditForm = document.getElementById("creditForm");
  const submitButton = creditForm?.querySelector("button[type='submit']");

  let editingCreditId = "";
  const creditsById = new Map();
  let pendingDeleteId = "";
  let pendingDeleteUntil = 0;

  if (!creditTableBody || !creditForm) return;

  function getFormField(...names) {
    for (const name of names) {
      if (creditForm[name]) return creditForm[name];
    }
    return null;
  }

  const produceNameField = getFormField("produceName", "itemName");
  const sellerNameField = getFormField("salesAgentName", "sellerName", "agentName");
  const branchNameField = getFormField("branchName", "branch");
  const nationalIdField = getFormField("nationalId", "nin");
  const amountDueField = getFormField("amountDueUgx", "amountDue");
  const tonnageField = getFormField("tonnageKgs", "tonnage");
  const dueDateField = getFormField("dueDate");
  const dueDateDisplayField = document.getElementById("creditDueDateDisplay");
  const dueDateIconButton = document.getElementById("creditDueDateIconBtn");
  const dueDatePickButton = document.getElementById("creditDueDatePickBtn");
  const dispatchDateField = getFormField("dispatchDate");
  const unitPriceHint = document.getElementById("creditUnitPriceHint");
  const unitPriceCache = new Map();
  const pendingPriceRequests = new Map();

  function formatDateOnly(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function syncDueDateDisplay() {
    if (!dueDateDisplayField || !dueDateField) return;
    dueDateDisplayField.value = dueDateField.value ? formatDateOnly(`${dueDateField.value}T00:00:00`) : "";
  }

  if (dueDateField) dueDateField.addEventListener("change", syncDueDateDisplay);
  if (dueDateIconButton && dueDateField) {
    dueDateIconButton.addEventListener("click", () => {
      if (typeof dueDateField.showPicker === "function") dueDateField.showPicker();
      else dueDateField.click();
    });
  }
  if (dueDateDisplayField && dueDateField) {
    dueDateDisplayField.style.cursor = "pointer";
    dueDateDisplayField.addEventListener("click", () => {
      if (typeof dueDateField.showPicker === "function") dueDateField.showPicker();
      else dueDateField.click();
    });
  }
  if (dueDatePickButton && dueDateField) {
    dueDatePickButton.addEventListener("click", () => {
      if (typeof dueDateField.showPicker === "function") dueDateField.showPicker();
      else dueDateField.click();
    });
  }

  if (sellerNameField) sellerNameField.value = userName;
  if (branchNameField) branchNameField.value = formatBranchName(assignedBranch);

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
    if (creditMessage) creditMessage.textContent = msg;
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

  function getProduceTypeField() {
    return getFormField("produceType", "type");
  }

  function normalizeItemName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function fetchUnitPriceForProduce(produceValue) {
    const key = normalizeItemName(produceValue);
    if (!key) return 0;

    const cached = Number(unitPriceCache.get(key) || 0);
    if (cached > 0) return cached;
    if (pendingPriceRequests.has(key)) return pendingPriceRequests.get(key);

    const request = (async () => {
      try {
        const url = `${API_BASE}/api/sales/unit-price?produceName=${encodeURIComponent(key)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return 0;
        const unitPrice = Number(data?.data?.unitPrice || 0);
        if (unitPrice > 0) unitPriceCache.set(key, unitPrice);
        return unitPrice > 0 ? unitPrice : 0;
      } catch (_) {
        return 0;
      } finally {
        pendingPriceRequests.delete(key);
      }
    })();

    pendingPriceRequests.set(key, request);
    return request;
  }

  async function updateAmountDueAuto() {
    if (!amountDueField || !tonnageField || !produceNameField) return;

    const produceName = String(produceNameField.value || "").trim();
    const tonnage = Number(tonnageField.value);
    let unitPrice = await fetchUnitPriceForProduce(produceName);
    const shouldAutoFill = produceName && Number.isFinite(tonnage) && tonnage > 0 && unitPrice > 0;

    amountDueField.readOnly = shouldAutoFill;
    if (shouldAutoFill) {
      const total = tonnage * unitPrice;
      amountDueField.value = String(total);
      if (unitPriceHint) {
        unitPriceHint.textContent = `Price: ${unitPrice.toLocaleString()} UGX per KG | Auto amount due: ${total.toLocaleString()} UGX`;
        unitPriceHint.classList.remove("price-error");
      }
    } else if (unitPriceHint) {
      if (produceName) {
        unitPriceHint.textContent = "No selling price found for this produce in current stock.";
        unitPriceHint.classList.add("price-error");
      } else {
        unitPriceHint.textContent = "Amount due will auto-calculate when produce price and tonnage are available.";
        unitPriceHint.classList.remove("price-error");
      }
    }
  }

  function initProduceField() {
    const itemField = produceNameField;
    if (itemField && itemField.tagName === "SELECT") {
      itemField.innerHTML = "";
    }
  }

  function resetForm() {
    creditForm.reset();
    editingCreditId = "";
    if (sellerNameField) sellerNameField.value = userName;
    if (branchNameField) branchNameField.value = formatBranchName(assignedBranch);
    if (dueDateField) dueDateField.value = "";
    syncDueDateDisplay();
    if (dispatchDateField) dispatchDateField.value = formatDisplayDate(new Date());
    if (amountDueField) amountDueField.readOnly = false;
    if (unitPriceHint) {
      unitPriceHint.textContent = "Amount due will auto-calculate when produce price and tonnage are available.";
      unitPriceHint.classList.remove("price-error");
    }
    if (submitButton) submitButton.textContent = "Save Credit Sale";
    updateAmountDueAuto();
  }

  function getPaymentStatusClass(status) {
    const value = String(status || "Pending");
    if (value === "Paid") return "status-paid";
    if (value === "Partial") return "status-partial";
    if (value === "Overdue") return "status-overdue";
    return "status-pending";
  }

  function parseMoneyInput(value) {
    const cleaned = String(value || "")
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/ugx/gi, "")
      .trim();
    return Number(cleaned);
  }

  function renderCreditRows(credits) {
    creditTableBody.innerHTML = "";
    creditsById.clear();

    if (!Array.isArray(credits) || credits.length === 0) {
      creditTableBody.innerHTML = "<tr><td colspan='15'>No matching credit sales records.</td></tr>";
      return;
    }

    credits.forEach((c) => {
      creditsById.set(c._id, c);
      const row = document.createElement("tr");
      const originalAmount = Number(c.originalAmountUgx ?? c.originalAmount ?? c.amountDueUgx ?? c.amountDue ?? 0).toLocaleString();
      const amountPaid = Number(c.amountPaidUgx ?? c.amountPaid ?? 0).toLocaleString();
      const amountDue = Number(c.amountDueUgx ?? c.amountDue ?? 0).toLocaleString();
      row.innerHTML = `
        <td>${c.buyerName}</td>
        <td>${c.nationalId ?? c.nin ?? "-"}</td>
        <td>${c.location}</td>
        <td>${c.contact}</td>
        <td><span class="amount-original">UGX ${originalAmount}</span></td>
        <td><span class="amount-paid">UGX ${amountPaid}</span></td>
        <td><span class="amount-due">UGX ${amountDue}</span></td>
        <td><span class="${getPaymentStatusClass(c.paymentStatus)}">${c.paymentStatus || "Pending"}</span></td>
        <td>${c.salesAgentName ?? c.agentName ?? "-"}</td>
        <td>${formatDisplayDate(c.dueDate)}</td>
        <td>${c.produceName ?? c.itemName ?? "-"}</td>
        <td>${c.produceType ?? c.type ?? "-"}</td>
        <td>${c.tonnageKgs ?? c.tonnage ?? "-"}</td>
        <td>${formatDisplayDate(c.dispatchDate)}</td>
        <td>
          <button class="payBtn" data-id="${c._id}" ${Number(c.amountDueUgx ?? c.amountDue ?? 0) <= 0 ? "disabled" : ""}>Pay</button>
          <button class="updateBtn" data-id="${c._id}">Update</button>
          <button class="deleteBtn" data-id="${c._id}">Delete</button>
        </td>
      `;
      creditTableBody.appendChild(row);
    });
  }

  async function loadCreditSales() {
    try {
      const res = await fetch(`${API_BASE}/api/credit`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage(data.message || "Failed to load credit sales.", "error");
        creditTableBody.innerHTML = "<tr><td colspan='15'>Failed to load credit sales. Please login again.</td></tr>";
        return;
      }

      if (!Array.isArray(data.data) || data.data.length === 0) {
        const branchLabel = formatBranchName(assignedBranch) || "your branch";
        creditTableBody.innerHTML = `<tr><td colspan='15'>No credit sales for ${branchLabel}</td></tr>`;
        return;
      }
      renderCreditRows(data.data);
    } catch (err) {
      console.error("Failed to load credit sales:", err);
      creditTableBody.innerHTML = "<tr><td colspan='15'>Error loading credit sales</td></tr>";
    }
  }

  creditTableBody.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const credit = creditsById.get(id);
    if (!credit) return;

    if (e.target.classList.contains("payBtn")) {
      const remaining = Number(credit.amountDueUgx ?? credit.amountDue ?? 0);
      if (remaining <= 0) {
        setMessage("This credit is already fully paid.", "info");
        return;
      }
      const entered = prompt(`Enter payment amount in UGX. Remaining debt: ${remaining}`);
      if (entered === null) return;
      const amount = parseMoneyInput(entered);
      if (!Number.isFinite(amount) || amount <= 0) {
        setMessage("Payment amount must be greater than 0. Example: 100000", "error");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/credit/${id}/pay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ amountPaidUgx: amount })
        });
        const data = await res.json();
        if (!data.success) {
          const msg = data.message || "Payment failed.";
          setMessage(msg, "error");
          return;
        }
        setMessage("Payment recorded successfully.", "success");
        loadCreditSales();
      } catch (err) {
        console.error("Failed to record payment:", err);
        setMessage("Error recording payment.", "error");
      }
      return;
    }

    if (e.target.classList.contains("updateBtn")) {
      editingCreditId = id;
      creditForm.buyerName.value = credit.buyerName;
      if (nationalIdField) nationalIdField.value = credit.nationalId ?? credit.nin ?? "";
      creditForm.location.value = credit.location;
      creditForm.contact.value = credit.contact;
      if (amountDueField) amountDueField.value = credit.amountDueUgx ?? credit.amountDue ?? "";
      if (dueDateField) dueDateField.value = new Date(credit.dueDate).toISOString().slice(0, 10);
      syncDueDateDisplay();
      if (produceNameField) produceNameField.value = credit.produceName ?? credit.itemName ?? "";
      const typeField = getProduceTypeField();
      if (typeField) typeField.value = credit.produceType ?? credit.type ?? "";
      if (tonnageField) tonnageField.value = credit.tonnageKgs ?? credit.tonnage ?? "";
      if (dispatchDateField) dispatchDateField.value = formatDisplayDate(credit.dispatchDate);
      if (submitButton) submitButton.textContent = "Update Credit Sale";
      await updateAmountDueAuto();
      setMessage("Credit sale loaded. Edit fields and submit to update.", "info");
      return;
    }

    if (!e.target.classList.contains("deleteBtn")) return;
    if (!requireDeleteConfirmation(id, "credit sale")) return;

    try {
      const res = await fetch(`${API_BASE}/api/credit/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || "Failed to delete credit sale.", "error");
        return;
      }
      if (editingCreditId === id) resetForm();
      setMessage("Credit sale deleted successfully.", "success");
      loadCreditSales();
    } catch (err) {
      console.error("Failed to delete credit sale:", err);
      setMessage("Error deleting credit sale.", "error");
    }
  });

  creditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const typeField = getProduceTypeField();
    const produceName = String(produceNameField?.value || "").trim().toLowerCase();
    const tonnageKgs = Number(tonnageField?.value);
    const unitPrice = await fetchUnitPriceForProduce(produceName);
    const autoAmountDue = produceName && Number.isFinite(tonnageKgs) && tonnageKgs > 0 && unitPrice > 0 ? tonnageKgs * unitPrice : null;

    const payload = {
      buyerName: String(creditForm.buyerName.value || "").trim(),
      nationalId: String(nationalIdField?.value || "").trim().toUpperCase(),
      location: String(creditForm.location.value || "").trim(),
      contact: String(creditForm.contact.value || "").trim(),
      amountDueUgx: autoAmountDue ?? Number(amountDueField?.value),
      salesAgentName: String(sellerNameField?.value || userName).trim(),
      dueDate: new Date(dueDateField?.value || new Date().toISOString().slice(0, 10)).toISOString(),
      produceName,
      produceType: String(typeField?.value || "").trim(),
      tonnageKgs,
      dispatchDate: new Date().toISOString(),
      branchName: assignedBranch
    };

    const url = editingCreditId ? `${API_BASE}/api/credit/${editingCreditId}` : `${API_BASE}/api/credit`;
    const method = editingCreditId ? "PUT" : "POST";

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
          data.message || (data.errors ? data.errors.map((er) => er.msg).join(", ") : "Failed to save credit sale.");
        setMessage(message, "error");
        return;
      }
      const notify = data.notification || (editingCreditId ? "Credit sale updated successfully." : "Credit sale recorded successfully.");
      setMessage(notify, "success");
      resetForm();
      loadCreditSales();
    } catch (err) {
      console.error("Error saving credit sale:", err);
      setMessage("Error saving credit sale.", "error");
    }
  });

  initProduceField();
  syncDueDateDisplay();
  tonnageField?.addEventListener("input", updateAmountDueAuto);
  produceNameField?.addEventListener("input", updateAmountDueAuto);
  produceNameField?.addEventListener("change", updateAmountDueAuto);
  resetForm();
  loadCreditSales();
  window.loadCreditSales = loadCreditSales;
});





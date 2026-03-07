fetch("seed-data.json")
  .then(response => response.json())
  .then(data => {
    console.log("Seed data loaded:", data);
    const pick = (obj, ...keys) => {
      for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
      }
      return "";
    };

    // Render Sales
    const salesTable = document.getElementById("sales-table");
    data.sales.forEach(sale => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${pick(sale, "produceName", "itemName")}</td>
        <td>${pick(sale, "tonnageKgs", "tonnage")}</td>
        <td>${pick(sale, "amountPaidUgx", "amountPaid")}</td>
        <td>${pick(sale, "buyerName")}</td>
        <td>${pick(sale, "salesAgentName", "agentName")}</td>
        <td>${pick(sale, "branchName", "branch")}</td>
        <td>${pick(sale, "saleDate", "date")}</td>
        <td>${pick(sale, "saleTime", "time")}</td>
      `;
      salesTable.appendChild(row);
    });

    // Render Credit Sales
    const creditTable = document.getElementById("credit-table");
    data.credit.forEach(c => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${pick(c, "buyerName")}</td>
        <td>${pick(c, "nationalId", "nin")}</td>
        <td>${pick(c, "location")}</td>
        <td>${pick(c, "contact")}</td>
        <td>${pick(c, "amountDueUgx", "amountDue")}</td>
        <td>${pick(c, "salesAgentName", "agentName")}</td>
        <td>${pick(c, "dueDate")}</td>
        <td>${pick(c, "produceName", "itemName")}</td>
        <td>${pick(c, "tonnageKgs", "tonnage")}</td>
        <td>${pick(c, "dispatchDate")}</td>
      `;
      creditTable.appendChild(row);
    });

    // Render Procurement
    const procTable = document.getElementById("procurement-table");
    data.procurement.forEach(p => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${pick(p, "produceName", "itemName")}</td>
        <td>${pick(p, "unit", "kg")}</td>
        <td>${pick(p, "tonnageKgs", "quantity")}</td>
        <td>${pick(p, "produceType", "category")}</td>
        <td>${pick(p, "costUgx", "cost")}</td>
        <td>${pick(p, "dealerName")}</td>
        <td>${pick(p, "branchName", "branch")}</td>
      `;
      procTable.appendChild(row);
    });

    // Render Stock
    const stockTable = document.getElementById("stock-table");
    data.stock.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${pick(s, "produceName", "itemName")}</td>
        <td>${pick(s, "tonnageKgs", "quantity")}</td>
        <td>${s.unit}</td>
       <td>${pick(s, "branchName", "branch")}</td>
        <td>${pick(s, "status")}</td>
      `;
      stockTable.appendChild(row);
    });
  })
  .catch(err => console.error("Error loading seed data:", err));

(() => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const authToken = localStorage.getItem("token");
  const assignedBranch = String(localStorage.getItem("branch") || "").trim().toLowerCase();
  const chartByCanvasId = new Map();
  const CANONICAL_ITEMS = ["beans", "grain maize", "cow peas", "g-nuts", "soybeans"];
  const ITEM_ALIASES = {
    beans: "beans",
    bean: "beans",
    maize: "grain maize",
    "grain maize": "grain maize",
    "grain-maize": "grain maize",
    "maize grain": "grain maize",
    "cow peas": "cow peas",
    cowpeas: "cow peas",
    "cow-peas": "cow peas",
    "g nuts": "g-nuts",
    "g-nuts": "g-nuts",
    gnuts: "g-nuts",
    "ground nuts": "g-nuts",
    groundnuts: "g-nuts",
    soybean: "soybeans",
    soyabean: "soybeans",
    soybeans: "soybeans",
    soyabeans: "soybeans",
    "soy bean": "soybeans",
    "soy beans": "soybeans",
    "soy-bean": "soybeans",
    "soy-beans": "soybeans",
    soya: "soybeans",
    "soya bean": "soybeans",
    "soya beans": "soybeans",
    "soya-bean": "soybeans",
    "soya-beans": "soybeans"
  };

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeBranch(value) {
    return normalizeText(value).replace(/\s+/g, " ");
  }

  function normalizeProduceName(value) {
    const normalized = normalizeText(value).replace(/[_-]/g, " ").replace(/\s+/g, " ");
    return ITEM_ALIASES[normalized] || normalized;
  }

  function getQuantity(row) {
    const value = Number(row?.tonnage ?? row?.tonnageKgs ?? row?.quantity ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function createHeaders() {
    return { Authorization: `Bearer ${authToken}` };
  }

  async function apiFetch(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: createHeaders() });
    let data;
    try {
      data = await res.json();
    } catch (err) {
      return [];
    }
    if (!res.ok || !data.success || !Array.isArray(data.data)) return [];
    return data.data;
  }

  function filterByBranch(rows, forceBranchOnly) {
    if (!forceBranchOnly || !assignedBranch) return rows;
    return rows.filter((row) => {
      const branch = normalizeBranch(row?.branch ?? row?.branchName ?? "");
      return branch === assignedBranch;
    });
  }

  function buildProductsSeries(stock, procurements, sales) {
    const totalsByItem = new Map(CANONICAL_ITEMS.map((item) => [item, 0]));
    const addItem = (name, qty) => {
      const key = normalizeProduceName(name);
      if (!key) return;
      if (!totalsByItem.has(key)) totalsByItem.set(key, 0);
      totalsByItem.set(key, (totalsByItem.get(key) || 0) + qty);
    };

    (stock || []).forEach((item) => {
      addItem(item?.produceName ?? item?.itemName, getQuantity(item));
    });

    if (Array.from(totalsByItem.values()).every((value) => value === 0)) {
      (procurements || []).forEach((item) => {
        addItem(item?.produceName ?? item?.itemName, getQuantity(item));
      });
    }

    if (Array.from(totalsByItem.values()).every((value) => value === 0)) {
      (sales || []).forEach((item) => {
        addItem(item?.produceName ?? item?.itemName, getQuantity(item));
      });
    }

    const ranked = Array.from(totalsByItem.entries())
      .filter(([name]) => CANONICAL_ITEMS.includes(name))
      .sort((a, b) => b[1] - a[1]);

    return {
      labels: ranked.map(([name]) => name.replace(/\b\w/g, (m) => m.toUpperCase())),
      values: ranked.map(([, qty]) => qty)
    };
  }

  function buildSalesSeries(sales) {
    const byProduce = new Map(CANONICAL_ITEMS.map((item) => [item, 0]));

    (sales || []).forEach((item) => {
      const produce = normalizeProduceName(item?.produceName ?? item?.itemName);
      if (!produce) return;
      const current = byProduce.get(produce) || 0;
      byProduce.set(produce, current + getQuantity(item));
    });

    const ranked = Array.from(byProduce.entries())
      .filter(([name]) => CANONICAL_ITEMS.includes(name))
      .sort((a, b) => b[1] - a[1]);

    return {
      labels: ranked.map(([name]) => name.replace(/\b\w/g, (m) => m.toUpperCase())),
      values: ranked.map(([, value]) => value)
    };
  }

  function buildCreditSeries(credits) {
    const byProduce = new Map(CANONICAL_ITEMS.map((item) => [item, 0]));

    (credits || []).forEach((item) => {
      const produce = normalizeProduceName(item?.produceName ?? item?.itemName);
      if (!produce) return;
      const current = byProduce.get(produce) || 0;
      byProduce.set(produce, current + getQuantity(item));
    });

    const ranked = Array.from(byProduce.entries())
      .filter(([name]) => CANONICAL_ITEMS.includes(name))
      .sort((a, b) => b[1] - a[1]);

    return {
      labels: ranked.map(([name]) => name.replace(/\b\w/g, (m) => m.toUpperCase())),
      values: ranked.map(([, value]) => value)
    };
  }

  function destroyChart(canvas) {
    if (!canvas?.id) return;
    const existing = chartByCanvasId.get(canvas.id);
    if (existing) {
      existing.destroy();
      chartByCanvasId.delete(canvas.id);
    }
  }

  function renderCategoryChart(canvas, series) {
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart(canvas);

    const hasData = series.values.some((value) => value > 0);
    const labels = hasData ? series.labels : ["No Item Data"];
    const actualValues = hasData ? series.values : [0];
    const totalActual = actualValues.reduce((sum, value) => sum + value, 0);
    const minimumVisibleSlice = totalActual > 0 ? Math.max(totalActual * 0.03, 1) : 1;
    const dataValues = hasData
      ? actualValues.map((value) => (value > 0 ? Math.max(value, minimumVisibleSlice) : 0))
      : [1];
    const colors = ["#2f7f36", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#14b8a6"];

    const chart = new Chart(canvas, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: dataValues,
            _actualValues: actualValues,
            backgroundColor: hasData
              ? labels.map((_, i) => colors[i % colors.length])
              : ["#cdd7d2"],
            borderColor: "#ffffff",
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              font: { size: 11 },
              generateLabels: (chart) => {
                const dataset = chart.data.datasets[0] || { data: [] };
                const rawValues = dataset._actualValues || [];
                return (chart.data.labels || []).map((label, i) => ({
                  text: `${label} (${Number(rawValues[i] || 0).toLocaleString()} kg)`,
                  fillStyle: Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor,
                  strokeStyle: dataset.borderColor,
                  lineWidth: dataset.borderWidth,
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (!hasData) return "No item data yet";
                const rawValues = ctx.dataset._actualValues || [];
                const actual = Number(rawValues[ctx.dataIndex] || 0);
                return `${ctx.label}: ${actual.toLocaleString()} kg`;
              }
            }
          }
        }
      }
    });

    chartByCanvasId.set(canvas.id, chart);
  }

  function renderSalesChart(canvas, series, options = {}) {
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart(canvas);

    const labels = series.labels.length > 0 ? series.labels : CANONICAL_ITEMS.map((name) => name.replace(/\b\w/g, (m) => m.toUpperCase()));
    const values = series.values.length > 0 ? series.values : new Array(labels.length).fill(0);
    const datasetLabel = String(options.label || "Sales (units)");
    const color = String(options.color || "#2f7f36");

    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: values,
            backgroundColor: color,
            borderRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
          x: { ticks: { font: { size: 11 }, autoSkip: false, maxRotation: 0, minRotation: 0 } }
        },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });

    chartByCanvasId.set(canvas.id, chart);
  }

  async function loadDashboardAnalytics(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || !authToken) return;

    const categoryCanvas = container.querySelector('[data-chart="category"]');
    const salesCanvas = container.querySelector('[data-chart="sales"]');
    const creditCanvas = container.querySelector('[data-chart="credit"]');
    if (!salesCanvas) return;

    const forceBranchOnly = Boolean(options.forceBranchOnly);
    const analyticsMode = String(options.analyticsMode || "");
    const [stockRaw, procurementsRaw, salesRaw, creditsRaw] = await Promise.all([
      apiFetch("/api/stock"),
      apiFetch("/api/procurement"),
      apiFetch("/api/sales"),
      apiFetch("/api/credit")
    ]);
    const stock = filterByBranch(stockRaw, forceBranchOnly);
    const procurements = filterByBranch(procurementsRaw, forceBranchOnly);
    const sales = filterByBranch(salesRaw, forceBranchOnly);
    const credits = filterByBranch(creditsRaw, forceBranchOnly);

    const categorySeries =
      analyticsMode === "sales-credit"
        ? buildSalesSeries(sales)
        : buildProductsSeries(stock, procurements, sales);
    const salesSeries = buildSalesSeries(sales);
    const creditSeries = buildCreditSeries(credits);

    if (analyticsMode === "sales-credit") {
      renderSalesChart(salesCanvas, salesSeries, { label: "Sales (units)", color: "#2f7f36" });
      if (creditCanvas) {
        renderSalesChart(creditCanvas, creditSeries, { label: "Credit (kg)", color: "#f59e0b" });
      }
    } else {
      if (categoryCanvas) {
        renderCategoryChart(categoryCanvas, categorySeries);
      }
      renderSalesChart(salesCanvas, salesSeries, { label: "Sales (units)", color: "#2f7f36" });
      if (creditCanvas) {
        renderSalesChart(creditCanvas, creditSeries, { label: "Credit (kg)", color: "#f59e0b" });
      }
    }
  }

  window.loadDashboardAnalytics = loadDashboardAnalytics;
})();



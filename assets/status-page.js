(async function () {
  const statusGrid = document.getElementById("status-grid");
  const kpis = document.getElementById("status-kpis");
  const boardMeta = document.getElementById("board-meta");
  const summaryMeta = document.getElementById("status-summary-meta");

  if (!statusGrid || !kpis || !boardMeta || !summaryMeta) {
    return;
  }

  function severityClass(status) {
    const value = String(status || "unknown").toLowerCase();
    if (value === "up") return "status-pill status-pill--up";
    if (value === "degraded") return "status-pill status-pill--degraded";
    return "status-pill status-pill--down";
  }

  function renderKpis(data) {
    const totals = data.summary || {};
    kpis.innerHTML = `
      <div class="card status-kpi"><h3>${totals.total_checks || 0}</h3><p>Total Checks</p></div>
      <div class="card status-kpi"><h3>${totals.up || 0}</h3><p>Operational</p></div>
      <div class="card status-kpi"><h3>${totals.down || 0}</h3><p>Outages</p></div>
      <div class="card status-kpi"><h3>${totals.degraded || 0}</h3><p>Degraded</p></div>
    `;
  }

  function renderCards(items) {
    statusGrid.innerHTML = "";
    items.forEach((item) => {
      const node = document.createElement("article");
      node.className = "card status-card";
      const lastError = item.last_error ? `<p class="status-card__error">${item.last_error}</p>` : "";
      node.innerHTML = `
        <div class="status-card__head">
          <div>
            <h3>${item.label}</h3>
            <p>${item.type || "service"}</p>
          </div>
          <span class="${severityClass(item.status)}">${item.status}</span>
        </div>
        <div class="status-card__body">
          <p><strong>Target:</strong> ${item.target}</p>
          <p><strong>Last Checked:</strong> ${item.checked_at || "-"}</p>
          <p><strong>Response Time:</strong> ${item.response_ms ? `${item.response_ms} ms` : "-"}</p>
          <p><strong>Consecutive Failures:</strong> ${item.consecutive_failures || 0}</p>
          ${lastError}
        </div>
      `;
      statusGrid.appendChild(node);
    });
  }

  async function loadStatus() {
    try {
      const sources = ["https://aibots.jcit.digital/ops-status.json", `/assets/ops-status.json?ts=${Date.now()}`];
      let response = null;
      for (const source of sources) {
        try {
          response = await fetch(source, { cache: "no-store" });
          if (response.ok) break;
        } catch (_) {
          response = null;
        }
      }
      if (!response || !response.ok) {
        throw new Error("Status feed unavailable.");
      }
      if (!response.ok) {
        throw new Error("Status feed unavailable.");
      }
      const data = await response.json();
      renderKpis(data);
      renderCards(Array.isArray(data.checks) ? data.checks : []);
      boardMeta.textContent = `Last monitor run: ${data.generated_at || "unknown"}`;
      summaryMeta.innerHTML = `
        <span>Monitor cadence: every ${data.interval_minutes || 10} minutes</span>
        <span>Auto reports: ${data.summary?.auto_reports_enabled ? "enabled" : "configured externally"}</span>
        <span>Current incidents: ${data.summary?.down || 0}</span>
      `;
    } catch (error) {
      boardMeta.textContent = error.message || "Could not load the status feed.";
      statusGrid.innerHTML = '<article class="card"><h3>Status feed unavailable</h3><p>The public status data could not be loaded right now.</p></article>';
      summaryMeta.innerHTML = "<span>Status feed unavailable</span>";
    }
  }

  loadStatus();
})();

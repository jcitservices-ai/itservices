const STORAGE_KEY = "jcit-admin-config-v1";

const els = {
  navItems: document.querySelectorAll("[data-view]"),
  panels: document.querySelectorAll("[data-panel]"),
  title: document.querySelector("[data-view-title]"),
  period: document.querySelector("[data-current-period]"),
  notice: document.querySelector("[data-notice]"),
  search: document.querySelector("[data-search]"),
  refresh: document.querySelector("[data-refresh]"),
  connectionDot: document.querySelector("[data-connection-dot]"),
  connectionLabel: document.querySelector("[data-connection-label]"),
  metrics: document.querySelector("[data-metrics]"),
  leaveQueue: document.querySelector("[data-leave-queue]"),
  recentTime: document.querySelector("[data-recent-time]"),
  configForm: document.querySelector("[data-config-form]"),
  useDemo: document.querySelector("[data-use-demo]"),
  signOut: document.querySelector("[data-sign-out]"),
  configStatus: document.querySelector("[data-config-status]"),
  importStatus: document.querySelector("[data-import-status]"),
  employeeDialog: document.querySelector("[data-employee-dialog]"),
  employeeForm: document.querySelector("[data-employee-form]"),
  openEmployee: document.querySelector("[data-open-employee]"),
  closeDialogButtons: document.querySelectorAll("[data-close-dialog]"),
  filters: {
    employee: document.querySelector("[data-filter='employee']"),
    project: document.querySelector("[data-filter='project']"),
    startDate: document.querySelector("[data-filter='startDate']"),
    endDate: document.querySelector("[data-filter='endDate']"),
    leaveStatus: document.querySelector("[data-filter='leaveStatus']"),
  },
  counts: {
    employees: document.querySelector("[data-employees-count]"),
    clients: document.querySelector("[data-clients-count]"),
    projects: document.querySelector("[data-projects-count]"),
    time: document.querySelector("[data-time-logs-count]"),
    leave: document.querySelector("[data-leave-requests-count]"),
    payslips: document.querySelector("[data-payslips-count]"),
    invoices: document.querySelector("[data-invoices-count]"),
    coaching: document.querySelector("[data-coaching-count]"),
    leaveQueue: document.querySelector("[data-leave-count]"),
    recentTime: document.querySelector("[data-time-count]"),
  },
};

const state = {
  mode: "demo",
  activeView: "overview",
  search: "",
  config: readConfig(),
  session: null,
  data: createDemoData(),
};

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveConfig(config) {
  state.config = { ...state.config, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
}

function showNotice(message, tone = "warn") {
  els.notice.textContent = message;
  els.notice.dataset.tone = tone;
  els.notice.hidden = false;
}

function hideNotice() {
  els.notice.hidden = true;
  els.notice.textContent = "";
}

function money(value, currency = "USD") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PHP" ? 0 : 2,
  }).format(amount);
}

function number(value, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "-") {
  const output = String(value ?? "").trim();
  return output || fallback;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function statusTone(value) {
  const v = normalize(value);
  if (["approved", "active", "valid", "closed", "generated", "acknowledged"].includes(v)) return "ok";
  if (["rejected", "inactive", "needs proof", "needs 5-day notice", "failed"].includes(v)) return "bad";
  if (["pending", "onboarding", "draft", "open"].includes(v)) return "warn";
  return "";
}

function statusChip(value) {
  return `<span class="status-chip ${statusTone(value)}">${escapeHtml(text(value))}</span>`;
}

function fullName(row) {
  return row?.name || row?.employees?.name || row?.employee_label || row?.team_member_label || "-";
}

function projectName(row) {
  return row?.project_name || row?.projects?.project_name || row?.project_label || row?.client_project_label || "-";
}

function showView(view) {
  state.activeView = view;
  els.navItems.forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  els.panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === view));
  els.title.textContent = {
    overview: "Overview",
    employees: "Employees",
    projects: "Clients & Projects",
    time: "Time Logs",
    leave: "Leave",
    payroll: "Payroll",
    coaching: "Coaching",
    settings: "Setup",
  }[view] || "Overview";
}

function setConnection(mode, message) {
  state.mode = mode;
  els.connectionDot.classList.toggle("is-live", mode === "live");
  els.connectionLabel.textContent = message;
  els.configStatus.textContent = mode === "live" ? "Connected" : "Not connected";
}

async function supabaseRequest(path, options = {}) {
  const url = String(state.config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = state.config.anonKey;
  if (!url || !anonKey) throw new Error("Supabase URL and anon key are required.");
  const token = state.session?.access_token || anonKey;
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const textBody = await response.text();
  const body = textBody ? JSON.parse(textBody) : null;
  if (!response.ok) {
    const detail = body?.message || body?.error_description || body?.error || response.statusText;
    throw new Error(detail);
  }
  return body;
}

async function signIn({ email, password, supabaseUrl, anonKey }) {
  saveConfig({ supabaseUrl, anonKey });
  const url = String(supabaseUrl || "").replace(/\/+$/, "");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error_description || body.msg || body.message || "Sign in failed.");
  }
  state.session = body;
  setConnection("live", `Signed in as ${email}`);
}

function encodeQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function getTable(table, params = {}) {
  const query = encodeQuery(params);
  return supabaseRequest(`/rest/v1/${table}${query ? `?${query}` : ""}`);
}

async function loadLiveData() {
  const tables = await Promise.all([
    getTable("employees", { select: "*", order: "name.asc" }),
    getTable("clients", { select: "*", order: "client_name.asc" }),
    getTable("projects", { select: "*,clients(client_name)", order: "project_name.asc" }).catch(() =>
      getTable("projects", { select: "*", order: "project_name.asc" })
    ),
    getTable("time_logs", {
      select: "*,employees(name,team_code),projects(project_name)",
      order: "work_date.desc",
      limit: 150,
    }).catch(() => getTable("time_logs", { select: "*", order: "work_date.desc", limit: 150 })),
    getTable("leave_requests", {
      select: "*,employees(name,team_code),projects(project_name)",
      order: "created_at.desc",
      limit: 150,
    }).catch(() => getTable("leave_requests", { select: "*", order: "created_at.desc", limit: 150 })),
    getTable("payslips", {
      select: "*,employees(name,team_code)",
      order: "pay_period_end.desc",
      limit: 100,
    }).catch(() => getTable("payslips", { select: "*", order: "pay_period_end.desc", limit: 100 })),
    getTable("invoices", {
      select: "*,projects(project_name)",
      order: "period_end.desc",
      limit: 100,
    }).catch(() => getTable("invoices", { select: "*", order: "period_end.desc", limit: 100 })),
    getTable("coaching_sessions", {
      select: "*,employees(name,team_code),projects(project_name)",
      order: "session_date.desc",
      limit: 100,
    }).catch(() => getTable("coaching_sessions", { select: "*", order: "session_date.desc", limit: 100 })),
    getTable("import_batches", { select: "*", order: "started_at.desc", limit: 1 }).catch(() => []),
  ]);

  state.data = {
    employees: tables[0] || [],
    clients: tables[1] || [],
    projects: tables[2] || [],
    timeLogs: tables[3] || [],
    leaveRequests: tables[4] || [],
    payslips: tables[5] || [],
    invoices: tables[6] || [],
    coaching: tables[7] || [],
    importBatches: tables[8] || [],
  };
}

async function refreshData() {
  hideNotice();
  els.refresh.disabled = true;
  try {
    if (state.mode === "live" && state.session) {
      await loadLiveData();
      showNotice("Live data refreshed.", "ok");
    } else {
      state.data = createDemoData();
      setConnection("demo", "Demo mode");
      showNotice("Using local demo data until Supabase is connected.");
    }
    render();
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    els.refresh.disabled = false;
  }
}

function filteredRows(rows, fields) {
  const query = normalize(state.search);
  if (!query) return rows;
  return rows.filter((row) =>
    fields.some((field) => normalize(typeof field === "function" ? field(row) : row[field]).includes(query))
  );
}

function renderMetrics() {
  const { employees, projects, timeLogs, leaveRequests, payslips, invoices } = state.data;
  const pendingLeave = leaveRequests.filter((item) => normalize(item.manager_status) === "pending").length;
  const hours = timeLogs.reduce((sum, item) => sum + Number(item.total_hours || 0), 0);
  const invoiceTotal = invoices.reduce((sum, item) => sum + Number(item.total_subtotal_usd || 0), 0);
  const payTotal = payslips.reduce((sum, item) => sum + Number(item.total_pay_php || 0), 0);

  const metrics = [
    ["Employees", employees.length, `${projects.length} active projects`],
    ["Pending Leave", pendingLeave, "Manager queue"],
    ["Tracked Hours", number(hours), "Imported time logs"],
    ["Invoices", money(invoiceTotal), `${money(payTotal, "PHP")} payroll`],
  ];

  els.metrics.innerHTML = metrics
    .map(
      ([label, value, hint]) => `
        <article class="metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <em>${escapeHtml(hint)}</em>
        </article>
      `
    )
    .join("");
}

function renderQueue() {
  const pending = state.data.leaveRequests
    .filter((item) => normalize(item.manager_status) === "pending" || normalize(item.rule_validation).startsWith("needs"))
    .slice(0, 8);

  els.counts.leaveQueue.textContent = pending.length;
  if (!pending.length) {
    els.leaveQueue.innerHTML = `<div class="empty-state">No pending leave requests.</div>`;
  } else {
    els.leaveQueue.innerHTML = `
      <div class="queue-list">
        ${pending
          .map(
            (item) => `
              <article class="queue-item">
                <div>
                  <strong>${escapeHtml(fullName(item))}</strong>
                  <div class="queue-meta">${escapeHtml(text(item.leave_type))} / ${formatDate(item.start_date)} - ${formatDate(item.end_date)}</div>
                </div>
                <div>${statusChip(item.rule_validation || item.manager_status)}</div>
                <div class="row-actions">
                  <button class="button" type="button" data-leave-action="approved" data-id="${escapeHtml(item.id)}">Approve</button>
                  <button class="button danger" type="button" data-leave-action="rejected" data-id="${escapeHtml(item.id)}">Reject</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  const recent = state.data.timeLogs.slice(0, 8);
  els.counts.recentTime.textContent = recent.length;
  els.recentTime.innerHTML = recent.length
    ? renderSimpleList(
        recent.map((item) => ({
          title: `${fullName(item)} / ${projectName(item)}`,
          meta: `${formatDate(item.work_date)} / ${text(item.activity)} / ${number(item.total_hours)} hours`,
          status: item.status,
        }))
      )
    : `<div class="empty-state">No time logs yet.</div>`;
}

function renderSimpleList(items) {
  return `
    <div class="queue-list">
      ${items
        .map(
          (item) => `
            <article class="queue-item">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="queue-meta">${escapeHtml(item.meta)}</div>
              </div>
              <div>${statusChip(item.status)}</div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTable(target, columns, rows, actions) {
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state">No records found.</div>`;
    return;
  }

  target.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
            ${actions ? "<th>Actions</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${columns.map((column) => `<td>${column.render(row)}</td>`).join("")}
                  ${actions ? `<td>${actions(row)}</td>` : ""}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderEmployees() {
  const rows = filteredRows(state.data.employees, ["name", "email", "team_code", "role", "status"]);
  els.counts.employees.textContent = rows.length;
  renderTable(
    document.querySelector("[data-table='employees']"),
    [
      { label: "Name", render: (row) => escapeHtml(row.name) },
      { label: "Team Code", render: (row) => escapeHtml(text(row.team_code)) },
      { label: "Email", render: (row) => escapeHtml(text(row.email)) },
      { label: "Role", render: (row) => statusChip(row.role) },
      { label: "Status", render: (row) => statusChip(row.status) },
      { label: "Budget", render: (row) => escapeHtml(money(row.total_budget_usd)) },
    ],
    rows
  );
}

function renderProjects() {
  const clients = filteredRows(state.data.clients, ["client_name", "email", "company", "status"]);
  const projects = filteredRows(state.data.projects, ["project_name", "project_details", "pay_scheme", "status"]);
  els.counts.clients.textContent = clients.length;
  els.counts.projects.textContent = projects.length;

  renderTable(
    document.querySelector("[data-table='clients']"),
    [
      { label: "Client", render: (row) => escapeHtml(row.client_name) },
      { label: "Company", render: (row) => escapeHtml(text(row.company)) },
      { label: "Email", render: (row) => escapeHtml(text(row.email)) },
      { label: "Status", render: (row) => statusChip(row.status) },
    ],
    clients
  );

  renderTable(
    document.querySelector("[data-table='projects']"),
    [
      { label: "Project", render: (row) => escapeHtml(row.project_name) },
      { label: "Client", render: (row) => escapeHtml(row.clients?.client_name || row.client_name || "-") },
      { label: "Scheme", render: (row) => escapeHtml(text(row.pay_scheme)) },
      { label: "Charge", render: (row) => escapeHtml(money(row.charges_per_month_usd)) },
      { label: "Status", render: (row) => statusChip(row.status) },
    ],
    projects
  );
}

function filteredTimeRows() {
  const filters = {
    employee: els.filters.employee.value,
    project: els.filters.project.value,
    startDate: els.filters.startDate.value,
    endDate: els.filters.endDate.value,
  };
  return filteredRows(state.data.timeLogs, [
    fullName,
    projectName,
    "activity",
    "status",
    "work_date",
  ]).filter((row) => {
    if (filters.employee && String(row.employee_id || row.employee_label || row.employees?.name) !== filters.employee) return false;
    if (filters.project && String(row.project_id || row.project_label || row.projects?.project_name) !== filters.project) return false;
    if (filters.startDate && row.work_date < filters.startDate) return false;
    if (filters.endDate && row.work_date > filters.endDate) return false;
    return true;
  });
}

function renderTime() {
  const rows = filteredTimeRows();
  els.counts.time.textContent = rows.length;
  renderTable(
    document.querySelector("[data-table='time']"),
    [
      { label: "Date", render: (row) => escapeHtml(formatDate(row.work_date)) },
      { label: "Employee", render: (row) => escapeHtml(fullName(row)) },
      { label: "Project", render: (row) => escapeHtml(projectName(row)) },
      { label: "Activity", render: (row) => escapeHtml(text(row.activity)) },
      { label: "Time", render: (row) => escapeHtml(`${text(row.time_in)} - ${text(row.time_out)}`) },
      { label: "Hours", render: (row) => escapeHtml(number(row.total_hours)) },
      { label: "Status", render: (row) => statusChip(row.status) },
    ],
    rows
  );
}

function filteredLeaveRows() {
  const status = normalize(els.filters.leaveStatus.value);
  return filteredRows(state.data.leaveRequests, [
    fullName,
    projectName,
    "leave_type",
    "manager_status",
    "rule_validation",
  ]).filter((row) => {
    if (!status) return true;
    return normalize(row.manager_status) === status || normalize(row.rule_validation) === status;
  });
}

function renderLeave() {
  const rows = filteredLeaveRows();
  els.counts.leave.textContent = rows.length;
  renderTable(
    document.querySelector("[data-table='leave']"),
    [
      { label: "Employee", render: (row) => escapeHtml(fullName(row)) },
      { label: "Type", render: (row) => escapeHtml(text(row.leave_type)) },
      { label: "Dates", render: (row) => escapeHtml(`${formatDate(row.start_date)} - ${formatDate(row.end_date)}`) },
      { label: "Days", render: (row) => escapeHtml(text(row.total_days, "0")) },
      { label: "Project", render: (row) => escapeHtml(projectName(row)) },
      { label: "Rule", render: (row) => statusChip(row.rule_validation || "Pending") },
      { label: "Status", render: (row) => statusChip(row.manager_status) },
    ],
    rows,
    (row) => `
      <div class="row-actions">
        <button class="button" type="button" data-leave-action="approved" data-id="${escapeHtml(row.id)}">Approve</button>
        <button class="button danger" type="button" data-leave-action="rejected" data-id="${escapeHtml(row.id)}">Reject</button>
      </div>
    `
  );
}

function renderPayroll() {
  const payslips = filteredRows(state.data.payslips, [fullName, "generation_type", "pdf_status"]);
  const invoices = filteredRows(state.data.invoices, [projectName, "invoice_code", "pdf_status"]);
  els.counts.payslips.textContent = payslips.length;
  els.counts.invoices.textContent = invoices.length;

  renderTable(
    document.querySelector("[data-table='payslips']"),
    [
      { label: "Employee", render: (row) => escapeHtml(fullName(row)) },
      { label: "Period", render: (row) => escapeHtml(`${formatDate(row.pay_period_start)} - ${formatDate(row.pay_period_end)}`) },
      { label: "Hours", render: (row) => escapeHtml(number(row.total_hours)) },
      { label: "Gross", render: (row) => escapeHtml(money(row.gross_usd_pay)) },
      { label: "Total PHP", render: (row) => escapeHtml(money(row.total_pay_php, "PHP")) },
      { label: "PDF", render: (row) => (row.pdf_url ? `<a href="${escapeHtml(row.pdf_url)}" target="_blank" rel="noreferrer">Open</a>` : statusChip(row.pdf_status || "Missing")) },
    ],
    payslips
  );

  renderTable(
    document.querySelector("[data-table='invoices']"),
    [
      { label: "Invoice", render: (row) => escapeHtml(text(row.invoice_code)) },
      { label: "Project", render: (row) => escapeHtml(projectName(row)) },
      { label: "Period", render: (row) => escapeHtml(`${formatDate(row.period_start)} - ${formatDate(row.period_end)}`) },
      { label: "Subtotal", render: (row) => escapeHtml(money(row.total_subtotal_usd)) },
      { label: "Payment", render: (row) => (row.wise_payment_request_link ? `<a href="${escapeHtml(row.wise_payment_request_link)}" target="_blank" rel="noreferrer">Wise</a>` : "-") },
      { label: "PDF", render: (row) => (row.pdf_url ? `<a href="${escapeHtml(row.pdf_url)}" target="_blank" rel="noreferrer">Open</a>` : statusChip(row.pdf_status || "Missing")) },
    ],
    invoices
  );
}

function renderCoaching() {
  const rows = filteredRows(state.data.coaching, [fullName, projectName, "client_label", "coaching_type", "status"]);
  els.counts.coaching.textContent = rows.length;
  renderTable(
    document.querySelector("[data-table='coaching']"),
    [
      { label: "Date", render: (row) => escapeHtml(formatDate(row.session_date)) },
      { label: "Team Member", render: (row) => escapeHtml(fullName(row)) },
      { label: "Project", render: (row) => escapeHtml(projectName(row)) },
      { label: "Type", render: (row) => escapeHtml(text(row.coaching_type)) },
      { label: "Status", render: (row) => statusChip(row.status) },
      { label: "Link", render: (row) => (row.schedule_link ? `<a href="${escapeHtml(row.schedule_link)}" target="_blank" rel="noreferrer">Open</a>` : "-") },
    ],
    rows
  );
}

function updateFilters() {
  const currentEmployee = els.filters.employee.value;
  const currentProject = els.filters.project.value;
  const employeeOptions = new Map();
  const projectOptions = new Map();

  state.data.timeLogs.forEach((row) => {
    const employeeValue = String(row.employee_id || row.employee_label || row.employees?.name || "");
    if (employeeValue) employeeOptions.set(employeeValue, fullName(row));
    const projectValue = String(row.project_id || row.project_label || row.projects?.project_name || "");
    if (projectValue) projectOptions.set(projectValue, projectName(row));
  });

  els.filters.employee.innerHTML = `<option value="">All employees</option>${[...employeeOptions]
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("")}`;
  els.filters.project.innerHTML = `<option value="">All projects</option>${[...projectOptions]
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("")}`;

  els.filters.employee.value = employeeOptions.has(currentEmployee) ? currentEmployee : "";
  els.filters.project.value = projectOptions.has(currentProject) ? currentProject : "";
}

function renderCounts() {
  els.counts.employees.textContent = state.data.employees.length;
  els.counts.clients.textContent = state.data.clients.length;
  els.counts.projects.textContent = state.data.projects.length;
  els.counts.time.textContent = state.data.timeLogs.length;
  els.counts.leave.textContent = state.data.leaveRequests.length;
  els.counts.payslips.textContent = state.data.payslips.length;
  els.counts.invoices.textContent = state.data.invoices.length;
  els.counts.coaching.textContent = state.data.coaching.length;
  const batch = state.data.importBatches?.[0];
  els.importStatus.textContent = batch ? batch.status : "Waiting";
}

function render() {
  const now = new Date();
  els.period.textContent = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  renderCounts();
  renderMetrics();
  updateFilters();
  renderQueue();
  renderEmployees();
  renderProjects();
  renderTime();
  renderLeave();
  renderPayroll();
  renderCoaching();
}

async function updateLeaveStatus(id, status) {
  if (!id) return;
  if (state.mode !== "live") {
    state.data.leaveRequests = state.data.leaveRequests.map((item) =>
      item.id === id ? { ...item, manager_status: status, reviewed_at: new Date().toISOString() } : item
    );
    render();
    showNotice(`Demo leave request marked ${status}.`, "ok");
    return;
  }
  await supabaseRequest(`/rest/v1/leave_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      manager_status: status,
      reviewed_at: new Date().toISOString(),
    }),
  });
  await refreshData();
  showNotice(`Leave request marked ${status}.`, "ok");
}

async function createEmployee(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.salary_usd = Number(payload.salary_usd || 0);
  payload.allowances_usd = Number(payload.allowances_usd || 0);
  payload.total_budget_usd = payload.salary_usd + payload.allowances_usd;
  payload.status = "active";
  payload.source_key = `manual:${payload.email || payload.team_code || Date.now()}`;

  if (state.mode !== "live") {
    state.data.employees = [{ id: crypto.randomUUID(), ...payload }, ...state.data.employees];
    render();
    showNotice("Demo employee created.", "ok");
    return;
  }

  await supabaseRequest("/rest/v1/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await refreshData();
  showNotice("Employee created.", "ok");
}

function createDemoData() {
  const employees = [
    {
      id: "demo-emp-1",
      name: "Operations Manager",
      email: "manager@example.com",
      team_code: "Jay",
      role: "manager",
      status: "active",
      salary_usd: 640,
      tools_usd: 17,
      allowances_usd: 40,
      total_budget_usd: 697,
    },
    {
      id: "demo-emp-2",
      name: "Team Member One",
      email: "member.one@example.com",
      team_code: "JL",
      role: "team_member",
      status: "active",
      salary_usd: 640,
      tools_usd: 17,
      allowances_usd: 40,
      total_budget_usd: 697,
    },
    {
      id: "demo-emp-3",
      name: "Team Member Two",
      email: "member.two@example.com",
      team_code: "Jo",
      role: "team_member",
      status: "onboarding",
      salary_usd: 640,
      tools_usd: 17,
      allowances_usd: 0,
      total_budget_usd: 657,
    },
  ];

  const clients = [
    {
      id: "demo-client-1",
      client_name: "Telxpress",
      email: "client@example.com",
      company: "Tele Express Business Systems",
      status: "active",
    },
    {
      id: "demo-client-2",
      client_name: "Sports SMM",
      email: "sports@example.com",
      company: "Sports Media",
      status: "onboarding",
    },
  ];

  const projects = [
    {
      id: "demo-project-1",
      project_name: "Project - Telxpress",
      clients: { client_name: "Telxpress" },
      pay_scheme: "Biweekly",
      charges_per_month_usd: 960,
      status: "active",
    },
    {
      id: "demo-project-2",
      project_name: "Project - Sports SMM",
      clients: { client_name: "Sports SMM" },
      pay_scheme: "Biweekly",
      charges_per_month_usd: 960,
      status: "onboarding",
    },
  ];

  const timeLogs = [
    {
      id: "demo-time-1",
      log_code: "LOG-1026",
      work_date: "2026-06-27",
      employees: { name: "Operations Manager", team_code: "Jay" },
      projects: { project_name: "Project - Telxpress" },
      activity: "Management",
      time_in: "00:00:00",
      time_out: "08:00:00",
      total_hours: 8,
      status: "closed",
    },
    {
      id: "demo-time-2",
      log_code: "LOG-1025",
      work_date: "2026-06-27",
      employees: { name: "Team Member One", team_code: "JL" },
      projects: { project_name: "Project - Telxpress" },
      activity: "Client Work",
      time_in: "00:00:00",
      time_out: "08:00:00",
      total_hours: 8,
      status: "closed",
    },
    {
      id: "demo-time-3",
      log_code: "LOG-1027",
      work_date: "2026-06-27",
      employees: { name: "Team Member Two", team_code: "Jo" },
      projects: { project_name: "Project - Sports SMM" },
      activity: "Client Work",
      time_in: "00:00:00",
      time_out: "08:00:00",
      total_hours: 8,
      status: "closed",
    },
  ];

  const leaveRequests = [
    {
      id: "demo-leave-1",
      employees: { name: "Team Member One", team_code: "JL" },
      projects: { project_name: "Project - Telxpress" },
      leave_type: "Vacation Leave",
      start_date: "2026-07-08",
      end_date: "2026-07-09",
      total_days: 2,
      rule_validation: "Valid",
      manager_status: "pending",
      notify_client: true,
    },
    {
      id: "demo-leave-2",
      employees: { name: "Team Member Two", team_code: "Jo" },
      projects: { project_name: "Project - Sports SMM" },
      leave_type: "Sick/Emergency",
      start_date: "2026-07-01",
      end_date: "2026-07-01",
      total_days: 1,
      rule_validation: "Needs Proof",
      manager_status: "pending",
      notify_client: false,
    },
  ];

  return {
    employees,
    clients,
    projects,
    timeLogs,
    leaveRequests,
    payslips: [
      {
        id: "demo-pay-1",
        employees: { name: "Team Member One", team_code: "JL" },
        pay_period_start: "2026-06-10",
        pay_period_end: "2026-06-27",
        total_hours: 88,
        gross_usd_pay: 352,
        total_pay_php: 21577,
        pdf_status: "generated",
      },
    ],
    invoices: [
      {
        id: "demo-inv-1",
        invoice_code: "02-0001",
        projects: { project_name: "Project - Telxpress" },
        period_start: "2026-06-10",
        period_end: "2026-06-27",
        total_subtotal_usd: 528,
        pdf_status: "linked",
        wise_payment_request_link: "https://wise.com",
      },
    ],
    coaching: [
      {
        id: "demo-coach-1",
        session_date: "2026-06-29",
        employees: { name: "Team Member One", team_code: "JL" },
        projects: { project_name: "Project - Telxpress" },
        coaching_type: "Training",
        status: "Acknowledged",
        schedule_link: "https://meet.google.com",
      },
    ],
    importBatches: [],
  };
}

els.navItems.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

els.search.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

els.refresh.addEventListener("click", refreshData);

Object.values(els.filters).forEach((filter) => {
  filter?.addEventListener("change", render);
});

els.configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.configForm);
  const values = Object.fromEntries(form.entries());
  try {
    await signIn({
      supabaseUrl: values.supabaseUrl,
      anonKey: values.anonKey,
      email: values.email,
      password: values.password,
    });
    await refreshData();
    showNotice("Signed in to Supabase.", "ok");
  } catch (error) {
    showNotice(error.message, "bad");
  }
});

els.useDemo.addEventListener("click", () => {
  state.session = null;
  state.data = createDemoData();
  setConnection("demo", "Demo mode");
  render();
  showNotice("Demo data loaded.");
});

els.signOut.addEventListener("click", () => {
  state.session = null;
  setConnection("demo", "Demo mode");
  render();
  showNotice("Signed out.");
});

els.openEmployee.addEventListener("click", () => {
  els.employeeDialog.showModal();
});

els.closeDialogButtons.forEach((button) => {
  button.addEventListener("click", () => els.employeeDialog.close());
});

els.employeeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createEmployee(els.employeeForm);
    els.employeeForm.reset();
    els.employeeDialog.close();
  } catch (error) {
    showNotice(error.message, "bad");
  }
});

document.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-leave-action]");
  if (!actionButton) return;
  actionButton.disabled = true;
  try {
    await updateLeaveStatus(actionButton.dataset.id, actionButton.dataset.leaveAction);
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    actionButton.disabled = false;
  }
});

function hydrateConfigForm() {
  if (state.config.supabaseUrl) els.configForm.elements.supabaseUrl.value = state.config.supabaseUrl;
  if (state.config.anonKey) els.configForm.elements.anonKey.value = state.config.anonKey;
}

hydrateConfigForm();
setConnection("demo", "Demo mode");
showView("overview");
render();

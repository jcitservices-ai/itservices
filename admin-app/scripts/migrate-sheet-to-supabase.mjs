import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(new URL("..", import.meta.url).pathname);
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

const SHEET_RANGES = [
  { key: "employees", sheet: "Employees", a1: "Employees!A1:AB1000", headerRow: 0 },
  { key: "clients", sheet: "Client Database", a1: "'Client Database'!A1:AD1000", headerRow: 3 },
  { key: "settings", sheet: "Settings & Validation", a1: "'Settings & Validation'!A1:AA1000", headerRow: 0 },
  { key: "time", sheet: "Time Logs", a1: "'Time Logs'!A1:I1000", headerRow: 0 },
  { key: "leave", sheet: "Vacation Leave Requests", a1: "'Vacation Leave Requests'!A1:K1000", headerRow: 0 },
  { key: "payCalendar", sheet: "Pay Calendar", a1: "'Pay Calendar'!A1:E1000", headerRow: 0 },
  { key: "payslips", sheet: "Payslip", a1: "Payslip!A1:Z1000", headerRow: 0 },
  { key: "invoices", sheet: "Invoices", a1: "Invoices!A1:Z1000", headerRow: 0 },
  { key: "coaching", sheet: "Coaching Database", a1: "'Coaching Database'!A1:Z1000", headerRow: 0 },
];

loadEnv(path.join(appRoot, ".env.local"));
loadEnv(path.join(appRoot, ".env"));
loadEnv(path.resolve(appRoot, "..", ".env"));

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JCIT_TITO_SPREADSHEET_ID",
];

const googleConfig = getServiceAccount();
const missing = required.filter((key) => !process.env[key]);
if (!googleConfig.email || !googleConfig.privateKey) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY");

if (missing.length) {
  console.log(`Missing required environment values: ${missing.join(", ")}`);
  console.log("Create admin-app/.env.local from .env.example, then rerun this script.");
  process.exit(2);
}

await main();

async function main() {
  const started = new Date().toISOString();
  const batch = await insertRows("import_batches", [
    {
      source: "google_sheet",
      spreadsheet_id: process.env.JCIT_TITO_SPREADSHEET_ID,
      status: "running",
      started_at: started,
      summary: {},
    },
  ]);
  const batchId = batch[0]?.id;
  const summary = {};

  try {
    const [values, formulas] = await Promise.all([
      readWorkbook("UNFORMATTED_VALUE"),
      readWorkbook("FORMULA"),
    ]);

    const context = {
      batchId,
      values,
      formulas,
      summary,
      employeesByEmail: new Map(),
      employeesByTeam: new Map(),
      employeesByName: new Map(),
      clientsByKey: new Map(),
      projectsByName: new Map(),
    };

    await importEmployees(context);
    await refreshEmployeeMaps(context);
    await importClientsAndProjects(context);
    await refreshProjectMaps(context);
    await importSettings(context);
    await importTimeLogs(context);
    await importLeaveRequests(context);
    await importPayCalendar(context);
    await importPayslips(context);
    await importInvoices(context);
    await importCoaching(context);

    await patchRows("import_batches", `id=eq.${batchId}`, {
      status: "completed",
      completed_at: new Date().toISOString(),
      summary,
    });

    console.log("Migration completed.");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (batchId) {
      await patchRows("import_batches", `id=eq.${batchId}`, {
        status: "failed",
        completed_at: new Date().toISOString(),
        summary,
        error_message: error.message,
      }).catch(() => null);
    }
    console.error(error.message);
    process.exit(1);
  }
}

async function importEmployees(context) {
  const rows = tableRows(context.values.employees, "Employees", 0);
  const managerCodes = new Set(rows.map((row) => value(row, "Manager")).filter(Boolean));
  const payload = rows
    .filter((row) => value(row, "Name") || value(row, "Email") || value(row, "Team Member"))
    .map((row) => {
      const teamCode = value(row, "Team Member");
      const role = managerCodes.has(teamCode) ? "manager" : "team_member";
      return withSource(row, {
        source_key: sourceKey("employee", value(row, "Email") || teamCode || value(row, "Name")),
        name: value(row, "Name") || teamCode || value(row, "Email"),
        email: lowerOrNull(value(row, "Email")),
        team_code: teamCode || null,
        role,
        status: "active",
        manager_label: value(row, "Manager") || null,
        gotyme_account_number: value(row, "Gotyme Account Number") || null,
        salary_usd: parseNumber(value(row, "Salary")),
        tools_usd: parseNumber(value(row, "Tools")),
        allowances_usd: parseNumber(value(row, "Allowances")),
        total_budget_usd: parseNumber(value(row, "Total Budget")),
        coach_email: lowerOrNull(value(row, "Coach Email")),
        imported_at: new Date().toISOString(),
      });
    });

  const imported = await upsertRows("employees", payload, "source_key");
  await recordMappings(context.batchId, payload, imported, "employees");
  context.summary.employees = imported.length;
}

async function importClientsAndProjects(context) {
  const rows = tableRows(context.values.clients, "Client Database", 3);
  const projectRows = rows.filter((row) => value(row, "Project Name"));
  const clientPayload = projectRows.map((row) =>
    withSource(row, {
      source_key: sourceKey("client", value(row, "Email") || value(row, "Client Name") || value(row, "Company")),
      client_name: value(row, "Client Name") || value(row, "Company") || value(row, "Project Name"),
      email: lowerOrNull(value(row, "Email")),
      phone: value(row, "Phone") || null,
      address: value(row, "Address") || null,
      company: value(row, "Company") || null,
      status: value(row, "Status") || "active",
      imported_at: new Date().toISOString(),
    })
  );

  const clients = await upsertRows("clients", dedupeBySource(clientPayload), "source_key");
  await recordMappings(context.batchId, dedupeBySource(clientPayload), clients, "clients");
  await refreshClientMaps(context);

  const projectPayload = projectRows.map((row) => {
    const clientKey = sourceKey("client", value(row, "Email") || value(row, "Client Name") || value(row, "Company"));
    return withSource(row, {
      source_key: sourceKey("project", value(row, "Project Name")),
      client_id: context.clientsByKey.get(clientKey)?.id || null,
      project_name: value(row, "Project Name"),
      project_details: value(row, "Project Details") || null,
      quantity: parseNumber(value(row, "Qty")),
      pay_scheme: value(row, "Pay Scheme") || null,
      charges_per_month_usd: parseNumber(value(row, "Charges per Month")),
      status: value(row, "Status") || "active",
      imported_at: new Date().toISOString(),
    });
  });

  const projects = await upsertRows("projects", projectPayload, "source_key");
  await recordMappings(context.batchId, projectPayload, projects, "projects");
  context.summary.clients = clients.length;
  context.summary.projects = projects.length;
}

async function importSettings(context) {
  const rows = tableRows(context.values.settings, "Settings & Validation", 0);
  const rates = rows
    .filter((row) => value(row, "Specific Activities"))
    .map((row) =>
      withSource(row, {
        source_key: sourceKey("activity", value(row, "Specific Activities")),
        activity: value(row, "Specific Activities"),
        rate_usd: parseNumber(value(row, "Rate in USD")),
        status: "active",
        imported_at: new Date().toISOString(),
      })
    );
  const importedRates = await upsertRows("activity_rates", rates, "source_key");
  await recordMappings(context.batchId, rates, importedRates, "activity_rates");

  const raw = context.values.settings || [];
  const settings = [
    {
      key: "company_announcement",
      value: { text: cell(raw, 1, 8) || "" },
    },
    {
      key: "next_invoice_number",
      value: { value: cell(raw, 1, 11) || "" },
    },
    {
      key: "manual_period",
      value: {
        start: sheetDate(cell(raw, 3, 11)),
        end: sheetDate(cell(raw, 4, 11)),
      },
    },
  ];
  await upsertRows("app_settings", settings, "key");
  context.summary.activity_rates = importedRates.length;
  context.summary.app_settings = settings.length;
}

async function importTimeLogs(context) {
  const rows = tableRows(context.values.time, "Time Logs", 0);
  const payload = rows
    .filter((row) => value(row, "Log ID"))
    .map((row) => {
      const employeeLabel = value(row, "Team Member");
      const projectLabel = value(row, "Project");
      return withSource(row, {
        source_key: sourceKey("time", value(row, "Log ID")),
        log_code: value(row, "Log ID"),
        work_date: sheetDate(value(row, "Date")),
        employee_id: employeeRef(context, employeeLabel)?.id || null,
        project_id: projectRef(context, projectLabel)?.id || null,
        employee_label: employeeLabel || null,
        project_label: projectLabel || null,
        activity: value(row, "Activity") || null,
        time_in: sheetTime(value(row, "Time In")),
        time_out: sheetTime(value(row, "Time Out")),
        total_hours: parseNumber(value(row, "Total Hours")),
        notes: value(row, "Notes") || null,
        status: value(row, "Time Out") ? "closed" : "open",
        imported_at: new Date().toISOString(),
      });
    })
    .filter((row) => row.work_date);

  const imported = await upsertRows("time_logs", payload, "source_key");
  await recordMappings(context.batchId, payload, imported, "time_logs");
  context.summary.time_logs = imported.length;
}

async function importLeaveRequests(context) {
  const rows = tableRows(context.values.leave, "Vacation Leave Requests", 0);
  const payload = rows
    .filter((row) => value(row, "Team Member") || value(row, "Leave Type") || value(row, "Start Date"))
    .map((row) => {
      const employeeLabel = value(row, "Team Member");
      const projectLabel = value(row, "Client / Project");
      const formulaRow = formulaRowFor(context.formulas.leave, row);
      return withSource(row, {
        source_key: sourceKey("leave", value(row, "Request ID") || `${employeeLabel}:${value(row, "Start Date")}:${row.__rowNumber}`),
        request_code: value(row, "Request ID") || null,
        requested_at: sheetDate(value(row, "Request Date")),
        employee_id: employeeRef(context, employeeLabel)?.id || null,
        project_id: projectRef(context, projectLabel)?.id || null,
        employee_label: employeeLabel || null,
        leave_type: value(row, "Leave Type") || "Unspecified",
        start_date: sheetDate(value(row, "Start Date")),
        end_date: sheetDate(value(row, "End Date")),
        total_days: Math.round(parseNumber(value(row, "Total Days"))),
        client_project_label: projectLabel || null,
        proof_url: extractUrl(value(row, "Proof of Leave") || value(formulaRow, "Proof of Leave")),
        reason: value(row, "Reason") || null,
        rule_validation: value(row, "Rule Validation") || null,
        manager_status: value(row, "Manager Status") || "pending",
        notify_client: parseBoolean(value(row, "Notify Client?")),
        auto_log_time: parseBoolean(value(row, "Auto-Log Time?")),
        notes: value(row, "Notes") || null,
        imported_at: new Date().toISOString(),
      });
    })
    .filter((row) => row.start_date && row.end_date);

  const imported = await upsertRows("leave_requests", payload, "source_key");
  await recordMappings(context.batchId, payload, imported, "leave_requests");
  context.summary.leave_requests = imported.length;
}

async function importPayCalendar(context) {
  const rows = tableRows(context.values.payCalendar, "Pay Calendar", 0);
  const payload = rows
    .filter((row) => value(row, "Client Invoice Date"))
    .map((row) => {
      const invoiceDate = sheetDate(value(row, "Client Invoice Date"));
      const coverage = splitCoverage(value(row, "Coverage"));
      return withSource(row, {
        source_key: sourceKey("pay_period", invoiceDate),
        client_invoice_date: invoiceDate,
        pay_date: sheetDate(value(row, "Pay Date")),
        coverage_start: coverage.start,
        coverage_end: coverage.end,
        coverage_label: value(row, "Coverage") || null,
        total_invoice_usd: parseNumber(value(row, "Total Invoice (USD)")),
        total_pay_php: parseNumber(value(row, "Total Pay (PHP)")),
        imported_at: new Date().toISOString(),
      });
    })
    .filter((row) => row.client_invoice_date);

  const imported = await upsertRows("pay_periods", payload, "source_key");
  await recordMappings(context.batchId, payload, imported, "pay_periods");
  context.summary.pay_periods = imported.length;
}

async function importPayslips(context) {
  const rows = tableRows(context.values.payslips, "Payslip", 0);
  const payload = rows
    .filter((row) => value(row, "Employee Name"))
    .map((row) => {
      const formulaRow = formulaRowFor(context.formulas.payslips, row);
      const employeeLabel = value(row, "Employee Name");
      const periodEnd = sheetDate(value(row, "Pay Period End"));
      return withSource(row, {
        source_key: sourceKey("payslip", `${employeeLabel}:${periodEnd || row.__rowNumber}`),
        employee_id: employeeRef(context, employeeLabel)?.id || null,
        employee_label: employeeLabel || null,
        pay_period_start: sheetDate(value(row, "Pay Period Start")),
        pay_period_end: periodEnd,
        total_hours: parseNumber(value(row, "Total Hours")),
        hourly_rate_usd: parseNumber(value(row, "Hourly Rate (USD)")),
        gross_usd_pay: parseNumber(value(row, "Gross USD Pay")),
        exchange_rate: parseNumber(value(row, "Exchange Rate (USD -> PHP)")),
        allowances_php: parseNumber(value(row, "Allowances (PHP)")),
        deductions_php: parseNumber(value(row, "Deductions (PHP)")),
        total_pay_php: parseNumber(value(row, "Total Pay (PHP)")),
        generation_type: value(row, "Generation Type") || null,
        pdf_url: extractUrl(value(row, "PDF Status") || value(formulaRow, "PDF Status")),
        pdf_status: stripFormulaLabel(value(row, "PDF Status")) || null,
        imported_at: new Date().toISOString(),
      });
    });

  const imported = await upsertRows("payslips", payload, "source_key");
  await recordMappings(context.batchId, payload, imported, "payslips");
  context.summary.payslips = imported.length;
}

async function importInvoices(context) {
  const rows = tableRows(context.values.invoices, "Invoices", 0);
  const payload = rows
    .filter((row) => value(row, "Invoice ID"))
    .map((row) => {
      const formulaRow = formulaRowFor(context.formulas.invoices, row);
      const projectLabel = value(row, "Project Name");
      return withSource(row, {
        source_key: sourceKey("invoice", value(row, "Invoice ID")),
        invoice_code: value(row, "Invoice ID"),
        project_id: projectRef(context, projectLabel)?.id || null,
        project_label: projectLabel || null,
        period_start: sheetDate(value(row, "Period Start")),
        period_end: sheetDate(value(row, "Period End")),
        line_items_raw: value(row, "Line Items Raw Data") || null,
        line_items: parseLineItems(value(row, "Line Items Raw Data")),
        total_subtotal_usd: parseNumber(value(row, "Total Subtotal (USD)")),
        wise_payment_request_link: value(row, "Wise Payment Request Link") || null,
        pdf_url: extractUrl(value(row, "PDF Status") || value(formulaRow, "PDF Status")),
        pdf_status: stripFormulaLabel(value(row, "PDF Status")) || null,
        imported_at: new Date().toISOString(),
      });
    });

  const imported = await upsertRows("invoices", payload, "source_key");
  await recordMappings(context.batchId, payload, imported, "invoices");
  context.summary.invoices = imported.length;
}

async function importCoaching(context) {
  const rows = tableRows(context.values.coaching, "Coaching Database", 0);
  const payload = rows
    .filter((row) => value(row, "Team Member") || value(row, "Date"))
    .map((row) => {
      const employeeLabel = value(row, "Team Member");
      const projectLabel = value(row, "Project Name") || value(row, "Project") || value(row, "Client");
      return withSource(row, {
        source_key: sourceKey("coaching", `${employeeLabel}:${value(row, "Date")}:${row.__rowNumber}`),
        session_date: sheetDate(value(row, "Date")),
        employee_id: employeeRef(context, employeeLabel)?.id || null,
        project_id: projectRef(context, projectLabel)?.id || null,
        team_member_label: employeeLabel || null,
        client_label: value(row, "Client") || null,
        coaching_type: value(row, "Type of Coaching") || null,
        schedule_link: extractUrl(value(row, "Schedule & Link")) || null,
        incident_details: value(row, "Details of Incident") || null,
        transcript_links: value(row, "Transcript Links") || null,
        commitment_goals: value(row, "Commitment & Goals") || null,
        coach_signature: value(row, "Coach Signature") || null,
        member_signature: value(row, "Team Member Signature") || null,
        status: value(row, "Status") || "pending",
        follow_up_date: sheetDate(value(row, "Follow-up Date")),
        reviewer: value(row, "Reviewer") || null,
        notes: value(row, "Notes") || null,
        raw_payload: row.__raw,
        imported_at: new Date().toISOString(),
      });
    });

  const imported = await upsertRows("coaching_sessions", payload, "source_key");
  await recordMappings(context.batchId, payload, imported, "coaching_sessions");
  context.summary.coaching_sessions = imported.length;
}

async function refreshEmployeeMaps(context) {
  const employees = await selectRows("employees");
  context.employeesByEmail = new Map();
  context.employeesByTeam = new Map();
  context.employeesByName = new Map();
  employees.forEach((employee) => {
    if (employee.email) context.employeesByEmail.set(employee.email.toLowerCase(), employee);
    if (employee.team_code) context.employeesByTeam.set(normalize(employee.team_code), employee);
    if (employee.name) context.employeesByName.set(normalize(employee.name), employee);
  });

  const updates = [];
  for (const employee of employees) {
    const manager = context.employeesByTeam.get(normalize(employee.manager_label));
    if (manager && manager.id !== employee.manager_employee_id) updates.push({ employee, manager });
  }
  await Promise.all(
    updates.map(({ employee, manager }) =>
      patchRows("employees", `id=eq.${employee.id}`, { manager_employee_id: manager.id })
    )
  );
}

async function refreshClientMaps(context) {
  const clients = await selectRows("clients");
  context.clientsByKey = new Map(clients.map((client) => [client.source_key, client]));
}

async function refreshProjectMaps(context) {
  const projects = await selectRows("projects");
  context.projectsByName = new Map(projects.map((project) => [normalize(project.project_name), project]));
}

function employeeRef(context, valueText) {
  const key = normalize(valueText);
  return context.employeesByTeam.get(key) || context.employeesByEmail.get(key) || context.employeesByName.get(key);
}

function projectRef(context, valueText) {
  return context.projectsByName.get(normalize(valueText));
}

async function readWorkbook(valueRenderOption) {
  const token = await getGoogleAccessToken();
  const params = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption,
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  SHEET_RANGES.forEach((item) => params.append("ranges", item.a1));
  const response = await fetch(`${GOOGLE_SHEETS_API}/${process.env.JCIT_TITO_SPREADSHEET_ID}/values:batchGet?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || "Google Sheets read failed.");
  return Object.fromEntries(
    SHEET_RANGES.map((item, index) => [item.key, body.valueRanges?.[index]?.values || []])
  );
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: googleConfig.email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(googleConfig.privateKey);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error_description || body.error || "Google auth failed.");
  return body.access_token;
}

async function supabase(pathname, options = {}) {
  const url = `${String(process.env.SUPABASE_URL).replace(/\/+$/, "")}${pathname}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || body?.error || `Supabase request failed: ${response.status}`);
  return body || [];
}

async function insertRows(table, rows) {
  if (!rows.length) return [];
  return supabase(`/rest/v1/${table}`, {
    method: "POST",
    body: JSON.stringify(rows),
  });
}

async function upsertRows(table, rows, conflictColumn) {
  const cleanRows = rows.map(stripMeta).filter((row) => Object.keys(row).length);
  if (!cleanRows.length) return [];
  return supabase(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictColumn)}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(cleanRows),
  });
}

async function selectRows(table) {
  return supabase(`/rest/v1/${table}?select=*`);
}

async function patchRows(table, filter, payload) {
  return supabase(`/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function recordMappings(batchId, sourceRows, importedRows, targetTable) {
  if (!batchId || !sourceRows.length || !importedRows.length) return;
  const bySource = new Map(importedRows.map((row) => [row.source_key || row.key, row]));
  const mappings = sourceRows
    .map((row) => {
      const imported = bySource.get(row.source_key);
      if (!imported?.id) return null;
      return {
        batch_id: batchId,
        source_sheet: row.__sourceSheet,
        source_row: row.__sourceRow,
        source_key: row.source_key,
        target_table: targetTable,
        target_id: imported.id,
      };
    })
    .filter(Boolean);
  await upsertRows("source_row_mappings", mappings, "source_key,target_table");
}

function tableRows(values, sheetName, headerRowIndex) {
  const headers = (values[headerRowIndex] || []).map((header, index) => cleanHeader(header) || `Column ${index + 1}`);
  return values.slice(headerRowIndex + 1).map((raw, index) => {
    const item = {
      __sourceSheet: sheetName,
      __sourceRow: headerRowIndex + index + 2,
      __rowNumber: headerRowIndex + index + 2,
      __raw: {},
    };
    headers.forEach((header, columnIndex) => {
      item[header] = raw[columnIndex] ?? "";
      item.__raw[header] = raw[columnIndex] ?? "";
    });
    return item;
  });
}

function value(row, ...aliases) {
  if (!row) return "";
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find((key) => normalize(key) === normalize(alias));
    if (found) return row[found] ?? "";
  }
  return "";
}

function cell(values, rowIndex, columnIndex) {
  return values?.[rowIndex]?.[columnIndex] ?? "";
}

function formulaRowFor(formulaValues, row) {
  return tableRows(formulaValues, row.__sourceSheet, 0).find((item) => item.__rowNumber === row.__rowNumber) || null;
}

function withSource(sourceRow, data) {
  return {
    ...data,
    __sourceSheet: sourceRow.__sourceSheet,
    __sourceRow: sourceRow.__sourceRow,
  };
}

function stripMeta(row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("__")));
}

function dedupeBySource(rows) {
  return [...new Map(rows.map((row) => [row.source_key, row])).values()];
}

function sourceKey(prefix, valueText) {
  const body = String(valueText || "blank")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `${prefix}:${body || "blank"}`;
}

function cleanHeader(valueText) {
  return String(valueText || "").trim();
}

function normalize(valueText) {
  return String(valueText || "").trim().toLowerCase();
}

function lowerOrNull(valueText) {
  const clean = String(valueText || "").trim().toLowerCase();
  return clean || null;
}

function parseNumber(valueText) {
  if (typeof valueText === "number") return Number.isFinite(valueText) ? valueText : 0;
  const clean = String(valueText || "").replace(/[^0-9.-]/g, "");
  const numberValue = Number(clean);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function parseBoolean(valueText) {
  if (typeof valueText === "boolean") return valueText;
  return ["true", "yes", "y", "1"].includes(normalize(valueText));
}

function sheetDate(valueText) {
  if (valueText === null || valueText === undefined || valueText === "") return null;
  if (typeof valueText === "number") {
    if (valueText < 1000) return null;
    const ms = Math.round((valueText - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const text = String(valueText).trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

function sheetTime(valueText) {
  if (valueText === null || valueText === undefined || valueText === "") return null;
  if (typeof valueText === "number") {
    const fraction = valueText % 1;
    const totalSeconds = Math.round(fraction * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  }
  const text = String(valueText).trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return text;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function splitCoverage(label) {
  const text = String(label || "");
  const parts = text.split(/\s+to\s+/i);
  return {
    start: sheetDate(parts[0]),
    end: sheetDate(parts[1]),
  };
}

function extractUrl(valueText) {
  const text = String(valueText || "");
  const formulaMatch = text.match(/^=HYPERLINK\("((?:""|[^"])*)"/i);
  if (formulaMatch) return formulaMatch[1].replace(/""/g, '"');
  const urlMatch = text.match(/https?:\/\/[^\s")]+/i);
  return urlMatch ? urlMatch[0] : null;
}

function stripFormulaLabel(valueText) {
  const text = String(valueText || "").trim();
  const labelMatch = text.match(/^=HYPERLINK\("(?:""|[^"]*)",\s*"((?:""|[^"])*)"\)/i);
  if (labelMatch) return labelMatch[1].replace(/""/g, '"');
  return text.replace(/^=.+$/i, "").trim();
}

function parseLineItems(raw) {
  return String(raw || "")
    .split("&&")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [description, hours, rate] = item.split("!!");
      return {
        description: description || "",
        hours: parseNumber(hours),
        rate_usd: parseNumber(rate),
      };
    });
}

function getServiceAccount() {
  let parsed = {};
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (rawJson) parsed = JSON.parse(rawJson);

  const email = String(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL ||
      parsed.client_email ||
      ""
  ).trim();

  let privateKey = String(
    process.env.GOOGLE_PRIVATE_KEY ||
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      parsed.private_key ||
      ""
  ).trim();

  if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = JSON.parse(privateKey);
  privateKey = privateKey.replace(/\\n/g, "\n");
  return { email, privateKey };
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    let valueText = trimmed.slice(index + 1).trim();
    if (
      (valueText.startsWith('"') && valueText.endsWith('"')) ||
      (valueText.startsWith("'") && valueText.endsWith("'"))
    ) {
      valueText = valueText.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = valueText.replace(/\\n/g, "\n");
  });
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

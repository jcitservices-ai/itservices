/**
 * JCIT TiTo Google Sheets automation.
 *
 * Install in the target Google Sheet:
 * Extensions > Apps Script > paste this file > Save > Run setupTiToSheets once.
 * Optional API mode: Deploy as Web App and set Script Property TITO_PUBLIC_TOKEN.
 */

const TITO = {
  employeesSheet: "Employees",
  timeSheet: "Time Logs",
  leaveSheet: "Vacation Leaves",
  payslipSheet: "Payslip",
  invoiceSheet: "TiTo Client Invoices",
  clientsSheet: "Clients",
  projectsSheet: "Projects",
  timeHeaders: [
    "Entry ID",
    "Username",
    "Team Member",
    "Project",
    "Time In",
    "Time Out",
    "Hours",
    "Status",
    "Notes",
    "Created At",
    "Updated At",
  ],
  leaveHeaders: [
    "Request ID",
    "Username",
    "Team Member",
    "Leave Type",
    "Start Date",
    "End Date",
    "Day Count",
    "Reason",
    "Client Approval",
    "Status",
    "Submitted At",
    "Reviewed By",
    "Reviewed At",
    "Notes",
  ],
  payslipHeaders: [
    "Payslip ID",
    "Username",
    "Team Member",
    "Period Start",
    "Period End",
    "Regular Hours",
    "Approved Leave Days",
    "Hourly Rate",
    "Gross Pay",
    "Deductions",
    "Net Pay",
    "Generated At",
    "Status",
  ],
  invoiceHeaders: [
    "Invoice ID",
    "Client",
    "Project",
    "Period Start",
    "Period End",
    "Billable Hours",
    "Hourly Rate",
    "Amount",
    "Generated At",
    "Status",
  ],
  firstPayDate: "2026-06-26",
  firstCoverageStart: "2026-06-10",
  firstCoverageEnd: "2026-06-22",
  payIntervalDays: 14,
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("JCIT TiTo")
    .addItem("Initialize TiTo Sheets", "setupTiToSheets")
    .addSeparator()
    .addItem("Generate Payslips", "generateTiToPayslips")
    .addItem("Generate Client Invoices", "generateTiToClientInvoices")
    .addToUi();
}

function setupTiToSheets() {
  ensureSheet_(TITO.timeSheet, TITO.timeHeaders);
  ensureSheet_(TITO.leaveSheet, TITO.leaveHeaders);
  ensureSheet_(TITO.payslipSheet, TITO.payslipHeaders);
  ensureSheet_(TITO.invoiceSheet, TITO.invoiceHeaders);
  ensureSheet_(TITO.projectsSheet, ["Project", "Client", "Assigned To", "Hourly Rate", "Status"]);
  ensureSheet_(TITO.clientsSheet, ["Client", "Billing Contact", "Email", "Default Hourly Rate", "Status"]);
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    verifyToken_(payload.token);
    const action = String(payload.action || "").toLowerCase();

    if (action === "login") return json_(handleLogin_(payload));
    if (action === "clock") return json_(handleClock_(payload));
    if (action === "leave") return json_(handleLeave_(payload));

    throw new Error("Unknown TiTo action.");
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function handleLogin_(payload) {
  const member = findMember_(payload.username, payload.password);
  const projects = projectsForMember_(member);
  const activeShift = findActiveShift_(member.username);
  return { ok: true, member: safeMember_(member), projects, activeShift };
}

function handleClock_(payload) {
  const member = findMember_(payload.username, payload.password);
  const action = String(payload.clockAction || payload.actionType || "").toLowerCase();
  const project = String(payload.project || "").trim();
  const notes = String(payload.notes || "").trim();
  ensureSheet_(TITO.timeSheet, TITO.timeHeaders);

  if (action === "time_in") {
    if (!project) throw new Error("Project is required.");
    if (findActiveShift_(member.username)) throw new Error("You are already clocked in.");
    const now = new Date();
    const row = [
      makeId_("TITO"),
      member.username,
      member.name,
      project,
      now,
      "",
      "",
      "Open",
      notes,
      now,
      now,
    ];
    SpreadsheetApp.getActive().getSheetByName(TITO.timeSheet).appendRow(row);
    return {
      ok: true,
      message: "Time in saved.",
      activeShift: {
        entryId: row[0],
        username: row[1],
        teamMember: row[2],
        project: row[3],
        timeIn: row[4],
        notes: row[8],
      },
    };
  }

  if (action === "time_out") {
    const active = findActiveShift_(member.username);
    if (!active) throw new Error("No open time entry found.");
    const now = new Date();
    const hours = Math.round(((now.getTime() - new Date(active.timeIn).getTime()) / 3_600_000) * 100) / 100;
    const sheet = SpreadsheetApp.getActive().getSheetByName(TITO.timeSheet);
    sheet.getRange(active.rowNumber, 6, 1, 6).setValues([[
      now,
      hours,
      "Closed",
      notes || active.notes || "",
      active.createdAt || active.timeIn,
      now,
    ]]);
    return { ok: true, message: "Time out saved. Total hours: " + hours + ".", activeShift: null };
  }

  throw new Error("Clock action must be time_in or time_out.");
}

function handleLeave_(payload) {
  const member = findMember_(payload.username, payload.password);
  const type = String(payload.leaveType || "").trim();
  if (["Vacation", "Sick", "Emergency"].indexOf(type) === -1) throw new Error("Invalid leave type.");
  const start = new Date(String(payload.startDate || "") + "T00:00:00");
  const end = new Date(String(payload.endDate || "") + "T00:00:00");
  if (end < start) throw new Error("Leave end date must be on or after the start date.");
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  ensureSheet_(TITO.leaveSheet, TITO.leaveHeaders);
  SpreadsheetApp.getActive().getSheetByName(TITO.leaveSheet).appendRow([
    makeId_("LEAVE"),
    member.username,
    member.name,
    type,
    payload.startDate,
    payload.endDate,
    days,
    String(payload.reason || "").trim(),
    String(payload.clientApproval || "Pending").trim(),
    "Submitted",
    new Date(),
    "",
    "",
    "",
  ]);
  return { ok: true, message: "Leave request submitted." };
}

function generateTiToPayslips() {
  setupTiToSheets();
  const ss = SpreadsheetApp.getActive();
  const timeRows = tableRows_(ss.getSheetByName(TITO.timeSheet));
  const leaveRows = tableRows_(ss.getSheetByName(TITO.leaveSheet));
  const paySheet = ss.getSheetByName(TITO.payslipSheet);
  const period = getTiToPayPeriod_(new Date());
  const periodStart = period.coverageStartDate;
  const periodEnd = period.coverageEndDate;
  const grouped = {};

  timeRows.forEach((row) => {
    if (String(row.Status || "").toLowerCase() !== "closed") return;
    const timeIn = new Date(row["Time In"]);
    if (timeIn < periodStart || timeIn > periodEnd) return;
    const key = row.Username;
    grouped[key] = grouped[key] || { name: row["Team Member"], hours: 0, leaveDays: 0 };
    grouped[key].hours += Number(row.Hours || 0);
  });

  leaveRows.forEach((row) => {
    if (String(row.Status || "").toLowerCase() !== "approved") return;
    const start = new Date(row["Start Date"]);
    if (start < periodStart || start > periodEnd) return;
    const key = row.Username;
    grouped[key] = grouped[key] || { name: row["Team Member"], hours: 0, leaveDays: 0 };
    grouped[key].leaveDays += Number(row["Day Count"] || 0);
  });

  Object.keys(grouped).forEach((username) => {
    const item = grouped[username];
    const rate = hourlyRateFor_(username);
    const gross = Math.round(item.hours * rate * 100) / 100;
    paySheet.appendRow([
      makeId_("PAY"),
      username,
      item.name,
      periodStart,
      periodEnd,
      item.hours,
      item.leaveDays,
      rate,
      gross,
      0,
      gross,
      new Date(),
      "Generated",
    ]);
  });
}

function generateTiToClientInvoices() {
  setupTiToSheets();
  const ss = SpreadsheetApp.getActive();
  const timeRows = tableRows_(ss.getSheetByName(TITO.timeSheet));
  const invoiceSheet = ss.getSheetByName(TITO.invoiceSheet);
  const now = new Date();
  const periodStart = startOfMonth_(now);
  const periodEnd = endOfMonth_(now);
  const grouped = {};

  timeRows.forEach((row) => {
    if (String(row.Status || "").toLowerCase() !== "closed") return;
    const timeIn = new Date(row["Time In"]);
    if (timeIn < periodStart || timeIn > periodEnd) return;
    const project = row.Project || "General Operations";
    grouped[project] = grouped[project] || { hours: 0, client: clientForProject_(project), rate: rateForProject_(project) };
    grouped[project].hours += Number(row.Hours || 0);
  });

  Object.keys(grouped).forEach((project) => {
    const item = grouped[project];
    const amount = Math.round(item.hours * item.rate * 100) / 100;
    invoiceSheet.appendRow([
      makeId_("INV"),
      item.client,
      project,
      periodStart,
      periodEnd,
      item.hours,
      item.rate,
      amount,
      new Date(),
      "Draft",
    ]);
  });
}

function getTiToPayPeriod_(referenceDate) {
  const firstPay = dateOnly_(TITO.firstPayDate).getTime();
  const current = dateOnly_(referenceDate).getTime();
  const intervalMs = TITO.payIntervalDays * 86_400_000;
  const cycle = Math.max(0, Math.ceil((current - firstPay) / intervalMs));
  const offset = cycle * TITO.payIntervalDays;
  const coverageStartDate = addDays_(dateOnly_(TITO.firstCoverageStart), offset);
  const coverageEndDate = addDays_(dateOnly_(TITO.firstCoverageEnd), offset);
  const payDate = addDays_(dateOnly_(TITO.firstPayDate), offset);
  return {
    payDate,
    coverageStartDate,
    coverageEndDate,
    coverageCode: Utilities.formatDate(coverageStartDate, Session.getScriptTimeZone(), "MMdd") + "-" + Utilities.formatDate(coverageEndDate, Session.getScriptTimeZone(), "MMdd"),
    coverageEndFullDayHours: 8,
  };
}

function dateOnly_(value) {
  const date = value instanceof Date ? value : new Date(String(value) + "T00:00:00");
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays_(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function findMember_(username, password) {
  const ss = SpreadsheetApp.getActive();
  const login = String(username || "").trim().toLowerCase();
  const sheet = ss.getSheetByName(TITO.employeesSheet);
  if (!sheet) throw new Error("Employees tab was not found.");
  const rows = tableRows_(sheet);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const user = String(row.Username || row.Email || row["Email Address"] || row.Name || "").trim();
    if (user.toLowerCase() !== login) continue;
    const stored = String(row.Password || row.Passcode || row.PIN || "").trim();
    const hash = String(row["Password Hash"] || row.password_hash || "").replace(/^sha256:/i, "").trim();
    const valid = hash ? sha256_(password) === hash.toLowerCase() : stored && stored === String(password || "");
    if (!valid) continue;
    if (["inactive", "disabled", "suspended"].indexOf(String(row.Status || "").toLowerCase()) !== -1) continue;
    return {
      username: user,
      name: row.Name || row["Full Name"] || row["Team Member"] || user,
      email: row.Email || row["Email Address"] || "",
      role: row.Role || row.Position || "",
      hourlyRate: Number(row["Hourly Rate"] || row.Rate || 0),
      assignedProjects: split_(row["Project Assigned"] || row["Assigned Projects"] || row.Projects || row.Project),
    };
  }
  throw new Error("Invalid username or password.");
}

function projectsForMember_(member) {
  const ss = SpreadsheetApp.getActive();
  const found = {};
  member.assignedProjects.forEach((project) => {
    if (project) found[project] = true;
  });
  const sheet = ss.getSheetByName(TITO.projectsSheet);
  if (sheet) {
    tableRows_(sheet).forEach((row) => {
      const project = row.Project || row["Project Name"];
      if (!project) return;
      const status = String(row.Status || "").toLowerCase();
      if (["inactive", "closed", "archived", "completed"].indexOf(status) !== -1) return;
      const assigned = String(row["Assigned To"] || row.Assignee || "").toLowerCase();
      if (!assigned || assigned.indexOf(member.username.toLowerCase()) !== -1 || assigned.indexOf(member.name.toLowerCase()) !== -1) {
        found[project] = true;
      }
    });
  }
  return Object.keys(found).sort();
}

function findActiveShift_(username) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TITO.timeSheet);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  const login = String(username || "").trim().toLowerCase();
  for (let i = values.length - 1; i >= 1; i -= 1) {
    const row = values[i];
    if (String(row[1] || "").trim().toLowerCase() === login && !row[5] && String(row[7] || "").toLowerCase() !== "closed") {
      return {
        rowNumber: i + 1,
        entryId: row[0],
        username: row[1],
        teamMember: row[2],
        project: row[3],
        timeIn: row[4],
        notes: row[8],
        createdAt: row[9],
      };
    }
  }
  return null;
}

function tableRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  return values.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function safeMember_(member) {
  return { username: member.username, name: member.name, email: member.email, role: member.role };
}

function makeId_(prefix) {
  return prefix + "-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss") + "-" + Utilities.getUuid().slice(0, 6).toUpperCase();
}

function split_(value) {
  return String(value || "").split(/[,;\n|]+/).map((item) => item.trim()).filter(Boolean);
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ""))
    .map((byte) => (byte + 256).toString(16).slice(-2))
    .join("");
}

function verifyToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty("TITO_PUBLIC_TOKEN");
  if (expected && token !== expected) throw new Error("Invalid TiTo token.");
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function startOfMonth_(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth_(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

function hourlyRateFor_(username) {
  const ss = SpreadsheetApp.getActive();
  const login = String(username || "").trim().toLowerCase();
  const sheet = ss.getSheetByName(TITO.employeesSheet);
  if (!sheet) return 0;
  const rows = tableRows_(sheet);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const user = String(row.Username || row.Email || row["Email Address"] || row.Name || "").trim().toLowerCase();
    if (user === login) return Number(row["Hourly Rate"] || row.Rate || 0);
  }
  return 0;
}

function clientForProject_(project) {
  const rows = tableRows_(SpreadsheetApp.getActive().getSheetByName(TITO.projectsSheet));
  const match = rows.find((row) => String(row.Project || "") === String(project || ""));
  return (match && match.Client) || "Unassigned Client";
}

function rateForProject_(project) {
  const rows = tableRows_(SpreadsheetApp.getActive().getSheetByName(TITO.projectsSheet));
  const match = rows.find((row) => String(row.Project || "") === String(project || ""));
  return Number((match && match["Hourly Rate"]) || 0);
}

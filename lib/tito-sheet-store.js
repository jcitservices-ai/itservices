const crypto = require("crypto");

const DEFAULT_SPREADSHEET_ID = "1USCMSN7yMDqeEC3SLcbmxqv6f2HHdJB3pdyPuKBzDTg";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const READ_RANGE = "A1:Z1000";

const TIME_SHEET = "TiTo Time Entries";
const LEAVE_SHEET = "TiTo Leave Requests";
const EMPLOYEES_SHEET = "Employees";
const PAYSLIP_SHEET_CANDIDATES = ["Payslip", "TiTo Payslips", "Payslips"];
const FIRST_PAY_DATE = "2026-06-26";
const FIRST_COVERAGE_START = "2026-06-10";
const FIRST_COVERAGE_END = "2026-06-22";
const PAY_INTERVAL_DAYS = 14;
const COVERAGE_END_FULL_DAY_HOURS = 8;
const LEAVE_NOTIFY_EMAILS = ["jake@jcit.digital", "jl@jcit.digital"];

const TIME_HEADERS = [
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
];

const LEAVE_HEADERS = [
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
];

const USERNAME_ALIASES = [
  "username",
  "user name",
  "login",
  "user",
  "team username",
  "employee id",
  "staff id",
  "email",
  "email address",
];

const PASSWORD_ALIASES = ["password", "passcode", "pin", "team password", "login password"];
const PASSWORD_HASH_ALIASES = ["password hash", "password_hash", "sha256", "sha256 password"];
const NAME_ALIASES = ["name", "full name", "team member", "employee name", "staff name"];
const EMAIL_ALIASES = ["email", "email address", "team email"];
const STATUS_ALIASES = ["status", "active", "account status"];
const ROLE_ALIASES = ["role", "position", "title"];
const PROJECT_ALIASES = ["project", "project name", "client", "client project"];
const PAY_DATE_ALIASES = ["pay date", "payout date", "payment date", "date paid", "payday"];
const COVERAGE_ALIASES = ["coverage", "pay coverage", "covered period", "period"];
const COVERAGE_START_ALIASES = ["coverage start", "period start", "start date", "from", "date from"];
const COVERAGE_END_ALIASES = ["coverage end", "period end", "end date", "to", "date to"];
const ASSIGNED_PROJECT_ALIASES = [
  "project assigned",
  "assigned project",
  "assigned projects",
  "projects",
  "project",
  "client",
  "account",
];
const ASSIGNED_TO_ALIASES = [
  "assigned to",
  "assignee",
  "team member",
  "employee",
  "username",
  "user",
  "owner",
];

let cachedAccessToken = null;

function getConfiguredSpreadsheetId() {
  return String(process.env.JCIT_TITO_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID).trim();
}

function getServiceAccount() {
  let parsed = {};
  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (rawJson) {
    try {
      parsed = JSON.parse(rawJson);
    } catch (error) {
      const parseError = new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
      parseError.statusCode = 500;
      throw parseError;
    }
  }

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

  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    try {
      privateKey = JSON.parse(privateKey);
    } catch (error) {
      privateKey = privateKey.slice(1, -1);
    }
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    const error = new Error(
      "Google Sheets access is not configured. Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, then share the spreadsheet with that service account."
    );
    error.statusCode = 503;
    throw error;
  }

  return { email, privateKey };
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const { email, privateKey } = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKey);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || "Google auth failed.");
    error.statusCode = 502;
    throw error;
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return cachedAccessToken.token;
}

async function googleRequest(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${GOOGLE_SHEETS_API}/${getConfiguredSpreadsheetId()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error?.message || "Google Sheets request failed.";
    const error = new Error(message);
    error.statusCode = response.status === 403 ? 503 : 502;
    throw error;
  }

  return data;
}

function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function columnLetter(index) {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function columnIndex(letters) {
  return String(letters || "")
    .toUpperCase()
    .split("")
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseCell(cell) {
  const match = String(cell || "").trim().match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    const error = new Error(`Invalid cell address: ${cell}`);
    error.statusCode = 500;
    throw error;
  }
  return {
    column: columnIndex(match[1]),
    row: Number(match[2]),
  };
}

async function getSpreadsheetMeta() {
  return googleRequest(
    "?includeGridData=false&fields=sheets(properties(sheetId,title,index,sheetType,hidden,gridProperties))"
  );
}

async function getValues(sheetName, range = READ_RANGE) {
  const a1 = `${quoteSheetName(sheetName)}!${range}`;
  const data = await googleRequest(`/values/${encodeURIComponent(a1)}?valueRenderOption=FORMATTED_VALUE`);
  return data.values || [];
}

async function updateValues(sheetName, startCell, values) {
  const start = parseCell(startCell);
  const endColumn = columnLetter(start.column + values[0].length - 1);
  const endRow = start.row + values.length - 1;
  const a1 = `${quoteSheetName(sheetName)}!${startCell}:${endColumn}${endRow}`;
  return googleRequest(`/values/${encodeURIComponent(a1)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

async function appendValues(sheetName, values) {
  const a1 = `${quoteSheetName(sheetName)}!A1`;
  return googleRequest(
    `/values/${encodeURIComponent(a1)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values }),
    }
  );
}

async function batchUpdate(requests) {
  return googleRequest(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeValue(value) {
  return String(value || "").trim();
}

function matchesAlias(header, aliases) {
  const key = normalizeKey(header);
  return aliases.some((alias) => normalizeKey(alias) === key);
}

function findHeader(headers, aliases) {
  return headers.find((header) => matchesAlias(header, aliases)) || "";
}

function valueFor(row, aliases) {
  const header = findHeader(row.headers, aliases);
  return header ? normalizeValue(row.values[header]) : "";
}

function isInactive(row) {
  const status = valueFor(row, STATUS_ALIASES).toLowerCase();
  return ["inactive", "disabled", "suspended", "closed", "no", "false"].includes(status);
}

function splitProjects(value) {
  return String(value || "")
    .split(/[,;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function rowsToObjects(sheet) {
  const values = sheet.values || [];
  const headers = (values[0] || []).map((header, index) => normalizeValue(header) || `Column ${index + 1}`);
  const rows = values.slice(1).map((raw, index) => {
    const rowValues = {};
    headers.forEach((header, columnIndex) => {
      rowValues[header] = normalizeValue(raw[columnIndex]);
    });
    return {
      rowNumber: index + 2,
      raw,
      headers,
      values: rowValues,
      sheetName: sheet.title,
    };
  });
  return { headers, rows };
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function passwordMatches(row, password) {
  const hash = valueFor(row, PASSWORD_HASH_ALIASES);
  if (hash) {
    const cleanHash = hash.replace(/^sha256:/i, "").trim().toLowerCase();
    return cleanHash === sha256(password);
  }

  const stored = valueFor(row, PASSWORD_ALIASES);
  return Boolean(stored) && stored === String(password || "");
}

async function loadWorkbook() {
  const meta = await getSpreadsheetMeta();
  const visibleSheets = (meta.sheets || [])
    .map((sheet) => sheet.properties)
    .filter((sheet) => sheet && !sheet.hidden && sheet.sheetType === "GRID");

  const sheets = await Promise.all(
    visibleSheets.map(async (sheet) => ({
      id: sheet.sheetId,
      title: sheet.title,
      values: await getValues(sheet.title),
    }))
  );

  return { meta, sheets };
}

function findMember(workbook, username, password) {
  const login = normalizeValue(username).toLowerCase();
  if (!login || !password) {
    const error = new Error("Username and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const employeeSheet = workbook.sheets.find((sheet) => normalizeKey(sheet.title) === normalizeKey(EMPLOYEES_SHEET));
  if (!employeeSheet) {
    const error = new Error("Employees tab was not found in the Google Sheet.");
    error.statusCode = 503;
    throw error;
  }

  const table = rowsToObjects(employeeSheet);
  const hasUserColumn = table.headers.some((header) => matchesAlias(header, USERNAME_ALIASES));
  const hasPasswordColumn = table.headers.some(
    (header) => matchesAlias(header, PASSWORD_ALIASES) || matchesAlias(header, PASSWORD_HASH_ALIASES)
  );

  if (!hasUserColumn || !hasPasswordColumn) {
    const error = new Error("Employees tab must include username and password columns.");
    error.statusCode = 503;
    throw error;
  }

  for (const row of table.rows) {
    const possibleLogins = [
      valueFor(row, USERNAME_ALIASES),
      valueFor(row, EMAIL_ALIASES),
      valueFor(row, NAME_ALIASES),
    ]
      .filter(Boolean)
      .map((item) => item.toLowerCase());

    if (!possibleLogins.includes(login)) continue;
    if (isInactive(row)) continue;
    if (!passwordMatches(row, password)) continue;

    const usernameValue = valueFor(row, USERNAME_ALIASES) || username;
    return {
      username: usernameValue,
      name: valueFor(row, NAME_ALIASES) || usernameValue,
      email: valueFor(row, EMAIL_ALIASES),
      role: valueFor(row, ROLE_ALIASES),
      sourceSheet: row.sheetName,
      rowNumber: row.rowNumber,
      assignedProjects: splitProjects(valueFor(row, ASSIGNED_PROJECT_ALIASES)),
    };
  }

  const error = new Error("Invalid username or password.");
  error.statusCode = 401;
  throw error;
}

function projectIsActive(row) {
  const status = valueFor(row, STATUS_ALIASES).toLowerCase();
  return !["inactive", "closed", "archived", "disabled", "complete", "completed"].includes(status);
}

function getProjectsForMember(workbook, member) {
  const found = new Set(member.assignedProjects || []);
  const identities = [member.username, member.email, member.name].filter(Boolean).map((item) => item.toLowerCase());

  for (const sheet of workbook.sheets) {
    const table = rowsToObjects(sheet);
    const projectHeader = findHeader(table.headers, PROJECT_ALIASES);
    if (!projectHeader) continue;

    for (const row of table.rows) {
      if (!projectIsActive(row)) continue;

      const project = valueFor(row, PROJECT_ALIASES);
      if (!project) continue;

      const assignedTo = valueFor(row, ASSIGNED_TO_ALIASES).toLowerCase();
      if (!assignedTo) {
        found.add(project);
        continue;
      }

      if (identities.some((identity) => assignedTo.includes(identity))) {
        found.add(project);
      }
    }
  }

  return [...found].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

async function ensureSheet(title, headers) {
  const meta = await getSpreadsheetMeta();
  let sheet = (meta.sheets || []).map((item) => item.properties).find((item) => item.title === title);

  if (!sheet) {
    await batchUpdate([{ addSheet: { properties: { title } } }]);
    const refreshed = await getSpreadsheetMeta();
    sheet = (refreshed.sheets || []).map((item) => item.properties).find((item) => item.title === title);
  }

  const firstRow = await getValues(title, `A1:${columnLetter(headers.length - 1)}1`);
  const currentHeaders = (firstRow[0] || []).map(normalizeValue);
  const missingHeaders = headers.some((header, index) => currentHeaders[index] !== header);

  if (missingHeaders) {
    await updateValues(title, "A1", [headers]);
  }

  return sheet;
}

function safeMember(member) {
  return {
    username: member.username,
    name: member.name,
    email: member.email,
    role: member.role,
  };
}

function startOfUtcDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addDays(dateValue, days) {
  const date = new Date(startOfUtcDate(dateValue) + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function formatCoverageCode(startDate, endDate) {
  const compact = (value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  };
  return `${compact(startDate)}-${compact(endDate)}`;
}

function getPayPeriod(referenceDate = new Date()) {
  const firstPay = startOfUtcDate(FIRST_PAY_DATE);
  const current = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );
  const intervalMs = PAY_INTERVAL_DAYS * 86_400_000;
  const cycle = Math.max(0, Math.ceil((current - firstPay) / intervalMs));
  const offset = cycle * PAY_INTERVAL_DAYS;
  const payDate = addDays(FIRST_PAY_DATE, offset);
  const coverageStart = addDays(FIRST_COVERAGE_START, offset);
  const coverageEnd = addDays(FIRST_COVERAGE_END, offset);

  return {
    payDate,
    coverageStart,
    coverageEnd,
    coverageCode: formatCoverageCode(coverageStart, coverageEnd),
    coverageEndFullDayHours: COVERAGE_END_FULL_DAY_HOURS,
    schedule: "Biweekly",
  };
}

async function findActiveShift(username) {
  const meta = await getSpreadsheetMeta();
  const hasTimeSheet = (meta.sheets || []).some((item) => item.properties.title === TIME_SHEET);
  if (!hasTimeSheet) return null;

  const values = await getValues(TIME_SHEET, "A1:K10000");
  const login = normalizeValue(username).toLowerCase();

  for (let index = values.length - 1; index >= 1; index -= 1) {
    const row = values[index] || [];
    const rowUser = normalizeValue(row[1]).toLowerCase();
    const timeOut = normalizeValue(row[5]);
    const status = normalizeValue(row[7]).toLowerCase();
    if (rowUser === login && !timeOut && status !== "closed") {
      return {
        rowNumber: index + 1,
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

function makeId(prefix) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function hoursBetween(start, end) {
  const started = Date.parse(start);
  const ended = Date.parse(end);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0;
  return Math.round(((ended - started) / 3_600_000) * 100) / 100;
}

function dayCount(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00`);
  const end = Date.parse(`${endDate}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    const error = new Error("Leave end date must be on or after the start date.");
    error.statusCode = 400;
    throw error;
  }
  return Math.round((end - start) / 86_400_000) + 1;
}

async function authenticate({ username, password }) {
  if (!normalizeValue(username) || !password) {
    const error = new Error("Username and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const workbook = await loadWorkbook();
  const member = findMember(workbook, username, password);
  const projects = getProjectsForMember(workbook, member);
  const activeShift = await findActiveShift(member.username);

  return {
    member: safeMember(member),
    projects,
    activeShift,
    payPeriod: getPayPeriod(),
  };
}

async function clockAction({ username, password, action, project, notes }) {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const projectName = normalizeValue(project);
  if (!["time_in", "time_out"].includes(normalizedAction)) {
    const error = new Error("Clock action must be time_in or time_out.");
    error.statusCode = 400;
    throw error;
  }

  if (!projectName && normalizedAction === "time_in") {
    const error = new Error("Project is required.");
    error.statusCode = 400;
    throw error;
  }

  const session = await authenticate({ username, password });
  const member = session.member;
  await ensureSheet(TIME_SHEET, TIME_HEADERS);
  const activeShift = await findActiveShift(member.username);
  const now = new Date().toISOString();

  if (normalizedAction === "time_in") {
    if (activeShift) {
      const error = new Error("You are already clocked in.");
      error.statusCode = 409;
      throw error;
    }

    const entry = [
      makeId("TITO"),
      member.username,
      member.name,
      projectName,
      now,
      "",
      "",
      "Open",
      normalizeValue(notes),
      now,
      now,
    ];
    await appendValues(TIME_SHEET, [entry]);

    return {
      message: "Time in saved.",
      activeShift: {
        entryId: entry[0],
        username: entry[1],
        teamMember: entry[2],
        project: entry[3],
        timeIn: entry[4],
        notes: entry[8],
        createdAt: entry[9],
      },
    };
  }

  if (!activeShift) {
    const error = new Error("No open time entry found.");
    error.statusCode = 409;
    throw error;
  }

  const totalHours = hoursBetween(activeShift.timeIn, now);
  const finalNotes = normalizeValue(notes) || activeShift.notes || "";
  const createdAt = activeShift.createdAt || activeShift.timeIn || now;
  await updateValues(TIME_SHEET, `F${activeShift.rowNumber}`, [
    [now, totalHours, "Closed", finalNotes, createdAt, now],
  ]);

  return {
    message: `Time out saved. Total hours: ${totalHours}.`,
    activeShift: null,
  };
}

async function submitLeave({
  username,
  password,
  leaveType,
  startDate,
  endDate,
  reason,
  clientApproval,
}) {
  const type = normalizeValue(leaveType);
  if (!["Vacation", "Sick", "Emergency"].includes(type)) {
    const error = new Error("Leave type must be Vacation, Sick, or Emergency.");
    error.statusCode = 400;
    throw error;
  }

  const days = dayCount(startDate, endDate);
  const session = await authenticate({ username, password });
  const member = session.member;
  const now = new Date().toISOString();
  const requestId = makeId("LEAVE");
  const clientApprovalStatus = normalizeValue(clientApproval) || "Pending";

  await ensureSheet(LEAVE_SHEET, LEAVE_HEADERS);
  await appendValues(LEAVE_SHEET, [
    [
      requestId,
      member.username,
      member.name,
      type,
      startDate,
      endDate,
      days,
      normalizeValue(reason),
      clientApprovalStatus,
      "Submitted",
      now,
      "",
      "",
      "",
    ],
  ]);

  const emailStatus = await sendLeaveEmails({
    requestId,
    member,
    leaveType: type,
    startDate,
    endDate,
    days,
    reason: normalizeValue(reason),
    clientApproval: clientApprovalStatus,
  });

  const notificationMessage =
    emailStatus.sentToEmployee || emailStatus.sentToAdmin
      ? "Leave request submitted and notifications sent."
      : "Leave request submitted. Email notifications are not configured yet.";

  return {
    message: notificationMessage,
    request: { id: requestId, leaveType: type, startDate, endDate, days, status: "Submitted" },
    emailStatus,
  };
}

function getEmailConfig() {
  return {
    apiKey: String(process.env.RESEND_API_KEY || "").trim(),
    from: String(
      process.env.JCIT_TITO_FROM_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        "JCIT Services <noreply@jcit.digital>"
    ).trim(),
    replyTo: String(process.env.JCIT_TITO_REPLY_TO || "jl@jcit.digital").trim(),
  };
}

async function sendResendEmail({ to, subject, text, html }) {
  const { apiKey, from, replyTo } = getEmailConfig();
  if (!apiKey) return { skipped: true, reason: "RESEND_API_KEY is not configured." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
      html,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Resend failed with ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  return { sent: true, payload };
}

function leaveEmailContent({ requestId, member, leaveType, startDate, endDate, days, reason, clientApproval }) {
  const subject = `JCIT leave request: ${member.name} (${leaveType})`;
  const text = [
    `Leave request ${requestId}`,
    `Employee: ${member.name} (${member.username})`,
    `Email: ${member.email || "Not listed"}`,
    `Leave type: ${leaveType}`,
    `Dates: ${startDate} to ${endDate} (${days} day/s)`,
    `Client approval: ${clientApproval}`,
    `Reason: ${reason || "-"}`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#102331;">
      <h1 style="margin:0 0 12px;">JCIT Leave Request</h1>
      <table style="border-collapse:collapse;width:100%;max-width:720px;border:1px solid #dce8ee;">
        ${[
          ["Request ID", requestId],
          ["Employee", `${member.name} (${member.username})`],
          ["Email", member.email || "Not listed"],
          ["Leave Type", leaveType],
          ["Dates", `${startDate} to ${endDate}`],
          ["Day Count", String(days)],
          ["Client Approval", clientApproval],
          ["Reason", reason || "-"],
        ]
          .map(
            ([label, value]) => `
              <tr>
                <th style="text-align:left;padding:10px;border-bottom:1px solid #dce8ee;background:#f5fafc;">${label}</th>
                <td style="padding:10px;border-bottom:1px solid #dce8ee;">${value}</td>
              </tr>`
          )
          .join("")}
      </table>
    </div>
  `.trim();
  return { subject, text, html };
}

function employeeLeaveConfirmation({ requestId, member, leaveType, startDate, endDate, days, clientApproval }) {
  const subject = `JCIT leave request received: ${requestId}`;
  const text = [
    `Hi ${member.name},`,
    "",
    "Your leave request has been received.",
    `Leave type: ${leaveType}`,
    `Dates: ${startDate} to ${endDate} (${days} day/s)`,
    `Client approval: ${clientApproval}`,
    "",
    "Jake and JL have been notified for review.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#102331;">
      <p>Hi ${member.name},</p>
      <p>Your leave request has been received.</p>
      <ul>
        <li><strong>Request ID:</strong> ${requestId}</li>
        <li><strong>Leave type:</strong> ${leaveType}</li>
        <li><strong>Dates:</strong> ${startDate} to ${endDate} (${days} day/s)</li>
        <li><strong>Client approval:</strong> ${clientApproval}</li>
      </ul>
      <p>Jake and JL have been notified for review.</p>
    </div>
  `.trim();
  return { subject, text, html };
}

async function sendLeaveEmails(details) {
  const adminContent = leaveEmailContent(details);
  const adminResult = await sendResendEmail({
    to: LEAVE_NOTIFY_EMAILS,
    ...adminContent,
  });

  let employeeResult = { skipped: true, reason: "Employee email is not listed." };
  if (details.member.email) {
    employeeResult = await sendResendEmail({
      to: details.member.email,
      ...employeeLeaveConfirmation(details),
    });
  }

  return {
    sentToAdmin: Boolean(adminResult.sent),
    sentToEmployee: Boolean(employeeResult.sent),
    skipped: Boolean(adminResult.skipped || employeeResult.skipped),
  };
}

function findSheetByTitle(workbook, candidates) {
  const lookup = new Set(candidates.map((name) => normalizeKey(name)));
  return workbook.sheets.find((sheet) => lookup.has(normalizeKey(sheet.title)));
}

function dateKey(value) {
  const text = normalizeValue(value);
  if (!text) return "";
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
  }

  return "";
}

function memberMatchesRow(row, member) {
  const identities = [member.username, member.email, member.name].filter(Boolean).map((item) => item.toLowerCase());
  const rowIdentities = [
    valueFor(row, USERNAME_ALIASES),
    valueFor(row, EMAIL_ALIASES),
    valueFor(row, NAME_ALIASES),
  ]
    .filter(Boolean)
    .map((item) => item.toLowerCase());

  return rowIdentities.some((identity) => identities.includes(identity));
}

function periodMatchesRow(row, period) {
  const payDate = valueFor(row, PAY_DATE_ALIASES);
  const coverage = valueFor(row, COVERAGE_ALIASES);
  const coverageStart = valueFor(row, COVERAGE_START_ALIASES);
  const coverageEnd = valueFor(row, COVERAGE_END_ALIASES);

  if (dateKey(payDate) === period.payDate) return true;
  if (dateKey(coverageStart) === period.coverageStart && dateKey(coverageEnd) === period.coverageEnd) return true;
  if (coverage && normalizeKey(coverage).includes(normalizeKey(period.coverageCode))) return true;
  return false;
}

function rowToPayslip(row) {
  const hidden = new Set(["password", "passcode", "pin", "password hash", "password_hash"]);
  const lines = row.headers
    .filter((header) => !hidden.has(header.toLowerCase()))
    .map((header) => ({
      label: header,
      value: row.values[header],
    }))
    .filter((line) => line.value !== "");

  return {
    sourceSheet: row.sheetName,
    rowNumber: row.rowNumber,
    lines,
  };
}

async function getPayslip({ username, password }) {
  const session = await authenticate({ username, password });
  const workbook = await loadWorkbook();
  const sheet = findSheetByTitle(workbook, PAYSLIP_SHEET_CANDIDATES);
  const period = getPayPeriod();

  if (!sheet) {
    const error = new Error("Payslip tab was not found in the Google Sheet.");
    error.statusCode = 404;
    throw error;
  }

  const table = rowsToObjects(sheet);
  const memberRows = table.rows.filter((row) => memberMatchesRow(row, session.member));
  if (!memberRows.length) {
    const error = new Error("No payslip row found for this employee.");
    error.statusCode = 404;
    throw error;
  }

  const matchedRow = memberRows.find((row) => periodMatchesRow(row, period)) || memberRows[memberRows.length - 1];

  return {
    member: session.member,
    payPeriod: period,
    payslip: rowToPayslip(matchedRow),
  };
}

module.exports = {
  authenticate,
  clockAction,
  submitLeave,
  getPayslip,
  getPayPeriod,
  getConfiguredSpreadsheetId,
};

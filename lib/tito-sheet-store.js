const crypto = require("crypto");

const DEFAULT_SPREADSHEET_ID = "1USCMSN7yMDqeEC3SLcbmxqv6f2HHdJB3pdyPuKBzDTg";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const READ_RANGE = "A1:Z1000";

const TIME_SHEET = "Time Logs";
const LEAVE_SHEET = "Vacation Leave Requests";
const EMPLOYEES_SHEET = "Employees";
const PAYSLIP_SHEET_CANDIDATES = ["Payslip"];
const SETTINGS_SHEET = "Settings & Validation";
const FIRST_PAY_DATE = "2026-06-26";
const FIRST_COVERAGE_START = "2026-06-10";
const FIRST_COVERAGE_END = "2026-06-22";
const PAY_INTERVAL_DAYS = 14;
const COVERAGE_END_FULL_DAY_HOURS = 8;
const LEAVE_NOTIFY_EMAILS = ["jake@jcit.digital", "jl@jcit.digital"];
const SHEET_TIME_ZONE = "America/New_York";
const CLIENT_SHEET_CANDIDATES = ["Client Database", "Clients", "Projects"];
const COACHING_SHEET_CANDIDATES = ["Coaching Database", "Coaching"];
const DEFAULT_MANAGER_EMAILS = ["jake@jcit.digital"];
const DEFAULT_COACH_EMAILS = ["jl@jcit.digital"];
const TITO_REPLY_TO_EMAIL = "jake@jcit.digital";

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
const PORTAL_PASSWORD_ALIASES = ["portal password", "password", "passcode", "pin", "team password", "login password"];
const PASSWORD_HASH_ALIASES = ["password hash", "password_hash", "sha256", "sha256 password"];
const FULL_NAME_ALIASES = ["name", "full name", "employee name", "staff name", "employee"];
const TEAM_MEMBER_ALIASES = ["team member", "member", "employee code", "staff id"];
const NAME_ALIASES = [...FULL_NAME_ALIASES, ...TEAM_MEMBER_ALIASES];
const EMAIL_ALIASES = ["email", "email address", "team email"];
const STATUS_ALIASES = ["status", "active", "account status"];
const ROLE_ALIASES = ["role", "position", "title"];
const PROJECT_ALIASES = ["project", "project name", "client", "client project"];
const CLIENT_PROJECT_ALIASES = ["client / project", "client/project", "client project", "project", "project name"];
const CLIENT_EMAIL_ALIASES = ["client email", "client e-mail", "billing email", "contact email", "email"];
const CLIENT_NAME_ALIASES = ["client name", "client", "contact name", "billing contact"];
const COMPANY_ALIASES = ["company", "company name", "client company"];
const PHONE_ALIASES = ["phone", "phone number", "contact number", "mobile"];
const ADDRESS_ALIASES = ["address", "client address", "company address"];
const PROJECT_DETAILS_ALIASES = ["project details", "details", "scope", "service", "services"];
const PAY_SCHEME_ALIASES = ["pay scheme", "billing scheme", "payment terms"];
const CHARGES_ALIASES = ["charges per month", "monthly charge", "monthly charges", "amount", "rate"];
const MANAGER_ALIASES = ["manager", "manager name", "team manager", "reports to"];
const MANAGER_EMAIL_ALIASES = ["manager email", "manager e-mail", "manager emails", "manager notification email"];
const COACH_ALIASES = ["coach", "coach name", "team coach"];
const COACH_EMAIL_ALIASES = ["coach email", "coach e-mail", "coach emails", "coach notification email"];
const COACHING_ID_ALIASES = ["coaching id", "coaching record id", "record id", "id"];
const COACHING_TYPE_ALIASES = ["coaching type", "type", "category"];
const TOPIC_ALIASES = ["topic", "subject", "coaching topic", "focus area"];
const ACTION_PLAN_ALIASES = ["action plan", "next steps", "commitment", "action items"];
const ACKNOWLEDGED_ALIASES = ["acknowledged", "acknowledgement", "acknowledgment", "employee acknowledged"];
const ACKNOWLEDGED_AT_ALIASES = ["acknowledged at", "acknowledgement date", "acknowledgment date", "ack date"];
const DATE_ALIASES = ["date", "log date", "work date"];
const ACTIVITY_ALIASES = ["activity", "task", "work type"];
const ENTRY_ID_ALIASES = ["entry id", "time log id", "log id", "record id", "id"];
const REQUEST_ID_ALIASES = ["request id", "leave id", "leave request id", "id"];
const TIME_IN_ALIASES = ["time in", "clock in", "clock-in", "timein", "start time", "start"];
const TIME_OUT_ALIASES = ["time out", "clock out", "clock-out", "timeout", "end time", "end"];
const HOURS_ALIASES = ["hours", "total hours", "work hours", "duration", "regular hours"];
const NOTES_ALIASES = ["notes", "note", "remarks", "comments", "comment"];
const CREATED_AT_ALIASES = ["created at", "created", "date created", "submitted at", "request date"];
const UPDATED_AT_ALIASES = ["updated at", "updated", "last updated", "modified at"];
const LEAVE_TYPE_ALIASES = ["leave type", "type"];
const START_DATE_ALIASES = ["start date", "date start", "from", "date from"];
const END_DATE_ALIASES = ["end date", "date end", "to", "date to"];
const DAY_COUNT_ALIASES = ["day count", "days", "number of days", "leave days", "total days"];
const REASON_ALIASES = ["reason", "leave reason", "details"];
const CLIENT_APPROVAL_ALIASES = ["client approval", "client approval status", "approval", "client approved"];
const PROOF_ALIASES = ["proof of leave", "proof", "leave proof", "attachment", "file"];
const MANAGER_STATUS_ALIASES = ["manager status", "manager approval", "status"];
const NOTIFY_CLIENT_ALIASES = ["notify client?", "notify client", "client notification"];
const AUTO_LOG_TIME_ALIASES = ["auto-log time?", "auto log time", "auto-log time"];
const REVIEWED_BY_ALIASES = ["reviewed by", "approver", "approved by"];
const REVIEWED_AT_ALIASES = ["reviewed at", "approved at", "review date"];
const PAY_DATE_ALIASES = ["pay date", "payout date", "payment date", "date paid", "payday"];
const COVERAGE_ALIASES = ["coverage", "pay coverage", "covered period", "period"];
const COVERAGE_START_ALIASES = ["coverage start", "period start", "start date", "from", "date from"];
const COVERAGE_END_ALIASES = ["coverage end", "period end", "end date", "to", "date to"];
const PAYSLIP_FILE_ALIASES = ["pdf status", "payslip file", "payslip pdf", "pdf", "file"];
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
      "Google Sheets access is not configured. Add OAuth credentials or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY."
    );
    error.statusCode = 503;
    throw error;
  }

  return { email, privateKey };
}

function getOAuthCredentials() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const refreshToken = String(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN || ""
  ).trim();

  if (!clientId && !clientSecret && !refreshToken) return null;

  if (!clientId || !clientSecret || !refreshToken) {
    const error = new Error(
      "Google OAuth access is not configured. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN."
    );
    error.statusCode = 503;
    throw error;
  }

  return { clientId, clientSecret, refreshToken };
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

  const oauth = getOAuthCredentials();
  if (oauth) {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        refresh_token: oauth.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error_description || data.error || "Google OAuth refresh failed.");
      error.statusCode = 502;
      throw error;
    }

    cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    };
    return cachedAccessToken.token;
  }

  const { email, privateKey } = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
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

async function googleDriveRequest(url, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error?.message || "Google Drive request failed.";
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

async function getValues(sheetName, range = READ_RANGE, valueRenderOption = "FORMATTED_VALUE") {
  const a1 = `${quoteSheetName(sheetName)}!${range}`;
  const data = await googleRequest(
    `/values/${encodeURIComponent(a1)}?valueRenderOption=${encodeURIComponent(valueRenderOption)}`
  );
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

function sanitizeFilename(value) {
  const cleaned = String(value || "leave-proof")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "leave-proof";
}

function escapeFormulaString(value) {
  return String(value || "").replace(/"/g, '""');
}

function hyperlinkFormula(url, label) {
  if (!url) return "";
  return `=HYPERLINK("${escapeFormulaString(url)}", "${escapeFormulaString(label || "Open file")}")`;
}

async function uploadProofFile(proof, member) {
  if (!proof || !proof.data) return null;

  const mimeType = normalizeValue(proof.mimeType) || "application/octet-stream";
  const base64Data = String(proof.data || "").replace(/^data:[^,]+,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  if (!buffer.length) return null;
  if (buffer.length > 4_000_000) {
    const error = new Error("Leave proof file must be 4 MB or smaller.");
    error.statusCode = 413;
    throw error;
  }

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const filename = `${timestamp}-${member.teamMember || member.name || "member"}-${sanitizeFilename(proof.name)}`;
  const folderId = String(process.env.JCIT_TITO_LEAVE_PROOF_FOLDER_ID || "").trim();
  const metadata = {
    name: filename,
    mimeType,
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const boundary = `tito_${crypto.randomBytes(12).toString("hex")}`;
  const delimiter = Buffer.from(`--${boundary}\r\n`);
  const closeDelimiter = Buffer.from(`\r\n--${boundary}--`);
  const metadataPart = Buffer.from(
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const mediaPartHeader = Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const body = Buffer.concat([delimiter, metadataPart, mediaPartHeader, buffer, closeDelimiter]);

  const file = await googleDriveRequest(
    `${GOOGLE_DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  return {
    id: file.id,
    name: file.name,
    url: file.webViewLink || (file.id ? `https://drive.google.com/file/d/${file.id}/view` : ""),
  };
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

function findHeaderIndex(headers, aliases) {
  return headers.findIndex((header) => matchesAlias(header, aliases));
}

function valueFor(row, aliases) {
  const header = findHeader(row.headers, aliases);
  return header ? normalizeValue(row.values[header]) : "";
}

function buildAppendRow(headers, assignments, label) {
  const row = new Array(headers.length).fill("");
  let matchedFields = 0;
  let lastIndex = -1;

  assignments.forEach(({ aliases, value }) => {
    const index = findHeaderIndex(headers, aliases);
    if (index === -1) return;
    row[index] = value;
    matchedFields += 1;
    lastIndex = Math.max(lastIndex, index);
  });

  if (!matchedFields) {
    const error = new Error(`${label} tab does not have recognized columns for this action.`);
    error.statusCode = 503;
    throw error;
  }

  return row.slice(0, lastIndex + 1);
}

function requireHeaderGroups(headers, groups, label) {
  const missing = groups
    .filter((group) => !group.options.some((aliases) => findHeaderIndex(headers, aliases) !== -1))
    .map((group) => group.label);

  if (missing.length) {
    const error = new Error(`${label} tab is missing recognized columns for: ${missing.join(", ")}.`);
    error.statusCode = 503;
    throw error;
  }
}

async function updateExistingRowFields(sheetName, rowNumber, headers, assignments) {
  const writes = [];

  assignments.forEach(({ aliases, value }) => {
    const index = findHeaderIndex(headers, aliases);
    if (index === -1) return;
    writes.push(updateValues(sheetName, `${columnLetter(index)}${rowNumber}`, [[value]]));
  });

  if (!writes.length) {
    const error = new Error(`${sheetName} tab does not have recognized columns to update.`);
    error.statusCode = 503;
    throw error;
  }

  await Promise.all(writes);
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

function rowsToObjectsWithDetectedHeader(sheet, requiredGroups = []) {
  const values = sheet.values || [];

  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const headers = (values[rowIndex] || []).map((header, index) => normalizeValue(header) || `Column ${index + 1}`);
    const hasRequiredHeaders = requiredGroups.every((aliases) =>
      headers.some((header) => matchesAlias(header, aliases))
    );

    if (!hasRequiredHeaders) continue;

    const rows = values.slice(rowIndex + 1).map((raw, index) => {
      const rowValues = {};
      headers.forEach((header, columnIndex) => {
        rowValues[header] = normalizeValue(raw[columnIndex]);
      });
      return {
        rowNumber: rowIndex + index + 2,
        raw,
        headers,
        values: rowValues,
        sheetName: sheet.title,
      };
    });

    return { headers, rows };
  }

  return rowsToObjects(sheet);
}

function findSheetByTitle(workbook, candidates) {
  const lookup = new Set(candidates.map((name) => normalizeKey(name)));
  return workbook.sheets.find((sheet) => lookup.has(normalizeKey(sheet.title)));
}

async function loadDetectedSheetTable(candidates, requiredGroups = [], range = "A1:Z10000", { required = true } = {}) {
  const meta = await getSpreadsheetMeta();
  const lookup = new Set(candidates.map((name) => normalizeKey(name)));
  const sheet = (meta.sheets || [])
    .map((item) => item.properties)
    .find((item) => item && !item.hidden && item.sheetType === "GRID" && lookup.has(normalizeKey(item.title)));

  if (!sheet) {
    if (!required) return null;
    const error = new Error(`${candidates[0]} tab was not found in the Google Sheet.`);
    error.statusCode = 503;
    throw error;
  }

  const table = rowsToObjectsWithDetectedHeader({
    title: sheet.title,
    values: await getValues(sheet.title, range),
  }, requiredGroups);

  return {
    id: sheet.sheetId,
    title: sheet.title,
    headers: table.headers,
    rows: table.rows,
  };
}

async function loadExistingSheetTable(sheetName, range = READ_RANGE, { required = true } = {}) {
  const meta = await getSpreadsheetMeta();
  const sheet = (meta.sheets || [])
    .map((item) => item.properties)
    .find((item) => !item.hidden && item.sheetType === "GRID" && normalizeKey(item.title) === normalizeKey(sheetName));

  if (!sheet) {
    if (!required) return null;
    const error = new Error(`${sheetName} tab was not found in the Google Sheet.`);
    error.statusCode = 503;
    throw error;
  }

  const table = rowsToObjects({
    title: sheet.title,
    values: await getValues(sheet.title, range),
  });

  if (!table.headers.length || table.headers.every((header) => /^Column \d+$/.test(header))) {
    const error = new Error(`${sheet.title} tab must keep its existing header row.`);
    error.statusCode = 503;
    throw error;
  }

  return {
    id: sheet.sheetId,
    title: sheet.title,
    headers: table.headers,
    rows: table.rows,
  };
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

  const stored = valueFor(row, PORTAL_PASSWORD_ALIASES);
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

function findMember(workbook, email, password) {
  const login = normalizeValue(email).toLowerCase();
  if (!login || !password) {
    const error = new Error("Email address and password are required.");
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
  const hasUserColumn = table.headers.some((header) => matchesAlias(header, EMAIL_ALIASES));
  const hasPasswordColumn = table.headers.some(
    (header) => matchesAlias(header, PORTAL_PASSWORD_ALIASES) || matchesAlias(header, PASSWORD_HASH_ALIASES)
  );

  if (!hasUserColumn || !hasPasswordColumn) {
    const error = new Error("Employees tab must include Email and Portal Password columns.");
    error.statusCode = 503;
    throw error;
  }

  for (const row of table.rows) {
    const fullName = valueFor(row, FULL_NAME_ALIASES);
    const teamMember = valueFor(row, TEAM_MEMBER_ALIASES);
    const employeeEmail = valueFor(row, EMAIL_ALIASES).toLowerCase();

    if (employeeEmail !== login) continue;
    if (isInactive(row)) continue;
    if (!passwordMatches(row, password)) continue;

    const usernameValue = valueFor(row, EMAIL_ALIASES) || email;
    return {
      username: usernameValue,
      name: fullName || teamMember || usernameValue,
      teamMember: teamMember || fullName || usernameValue,
      email: valueFor(row, EMAIL_ALIASES),
      role: valueFor(row, ROLE_ALIASES),
      manager: valueFor(row, MANAGER_ALIASES),
      managerEmail: valueFor(row, MANAGER_EMAIL_ALIASES),
      coach: valueFor(row, COACH_ALIASES),
      coachEmail: valueFor(row, COACH_EMAIL_ALIASES),
      sourceSheet: row.sheetName,
      rowNumber: row.rowNumber,
      assignedProjects: splitProjects(valueFor(row, ASSIGNED_PROJECT_ALIASES)),
    };
  }

  const error = new Error("Invalid email address or password.");
  error.statusCode = 401;
  throw error;
}

function findMemberByEmail(workbook, email) {
  const login = normalizeValue(email).toLowerCase();
  if (!login) {
    const error = new Error("Email address is required.");
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
  for (const row of table.rows) {
    const employeeEmail = valueFor(row, EMAIL_ALIASES);
    if (employeeEmail.toLowerCase() !== login) continue;
    if (isInactive(row)) continue;

    const fullName = valueFor(row, FULL_NAME_ALIASES);
    const teamMember = valueFor(row, TEAM_MEMBER_ALIASES);
    const usernameValue = employeeEmail || email;

    return {
      username: usernameValue,
      name: fullName || teamMember || usernameValue,
      teamMember: teamMember || fullName || usernameValue,
      email: employeeEmail,
      role: valueFor(row, ROLE_ALIASES),
      portalPassword: valueFor(row, PORTAL_PASSWORD_ALIASES),
      manager: valueFor(row, MANAGER_ALIASES),
      managerEmail: valueFor(row, MANAGER_EMAIL_ALIASES),
      coach: valueFor(row, COACH_ALIASES),
      coachEmail: valueFor(row, COACH_EMAIL_ALIASES),
      sourceSheet: row.sheetName,
      rowNumber: row.rowNumber,
      assignedProjects: splitProjects(valueFor(row, ASSIGNED_PROJECT_ALIASES)),
    };
  }

  return null;
}

function getSettingsOptions(workbook) {
  const settingsSheet = workbook.sheets.find((sheet) => normalizeKey(sheet.title) === normalizeKey(SETTINGS_SHEET));
  if (!settingsSheet) return { projects: [], activities: [] };

  const table = rowsToObjects(settingsSheet);
  const projectHeader = table.headers.find((header) => normalizeKey(header) === "approvedprojects");
  const activityHeader = table.headers.find((header) => normalizeKey(header) === "specificactivities");

  const projects = new Set();
  const activities = new Set();
  table.rows.forEach((row) => {
    if (projectHeader && row.values[projectHeader]) projects.add(row.values[projectHeader]);
    if (activityHeader && row.values[activityHeader]) activities.add(row.values[activityHeader]);
  });

  return {
    projects: [...projects].sort((a, b) => a.localeCompare(b)),
    activities: [...activities].sort((a, b) => a.localeCompare(b)),
  };
}

function projectIsActive(row) {
  const status = valueFor(row, STATUS_ALIASES).toLowerCase();
  return !["inactive", "closed", "archived", "disabled", "complete", "completed"].includes(status);
}

function getProjectsForMember(workbook, member) {
  const found = new Set(member.assignedProjects || []);
  const identities = [member.username, member.email, member.name, member.teamMember]
    .filter(Boolean)
    .map((item) => item.toLowerCase());

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

async function loadAuthenticatedMember({ username, email, password }) {
  const loginEmail = normalizeValue(email || username);
  if (!loginEmail || !password) {
    const error = new Error("Email address and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const workbook = await loadWorkbook();
  const member = findMember(workbook, loginEmail, password);
  return { workbook, member };
}

function extractEmails(value) {
  return String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
}

function uniqueEmails(emails) {
  const seen = new Set();
  return emails
    .map((email) => normalizeValue(email).toLowerCase())
    .filter((email) => {
      if (!email || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

function emailsFromEnv(name, fallback = []) {
  const raw = normalizeValue(process.env[name]);
  return raw ? extractEmails(raw) : fallback;
}

function findEmployeeByIdentity(workbook, identity) {
  const target = normalizeValue(identity);
  if (!target) return null;

  const employeeSheet = workbook.sheets.find((sheet) => normalizeKey(sheet.title) === normalizeKey(EMPLOYEES_SHEET));
  if (!employeeSheet) return null;

  const targetKey = normalizeKey(target);
  const targetLower = target.toLowerCase();
  const table = rowsToObjects(employeeSheet);

  return table.rows.find((row) => {
    const identities = [
      valueFor(row, EMAIL_ALIASES),
      valueFor(row, FULL_NAME_ALIASES),
      valueFor(row, TEAM_MEMBER_ALIASES),
      valueFor(row, NAME_ALIASES),
    ].filter(Boolean);

    return identities.some((item) => item.toLowerCase() === targetLower || normalizeKey(item) === targetKey);
  }) || null;
}

function findClientForProject(workbook, projectName) {
  const target = normalizeValue(projectName);
  if (!target) return null;

  const targetKey = normalizeKey(target);
  const matches = [];

  workbook.sheets
    .filter((sheet) => CLIENT_SHEET_CANDIDATES.some((name) => normalizeKey(sheet.title) === normalizeKey(name)))
    .forEach((sheet) => {
      const table = rowsToObjectsWithDetectedHeader(sheet, [PROJECT_ALIASES, CLIENT_EMAIL_ALIASES]);

      table.rows.forEach((row) => {
        const project = valueFor(row, PROJECT_ALIASES);
        const projectKey = normalizeKey(project);
        if (!projectKey) return;
        if (projectKey !== targetKey && !projectKey.includes(targetKey) && !targetKey.includes(projectKey)) return;
        if (!projectIsActive(row)) return;

        matches.push({
          project,
          clientName: valueFor(row, CLIENT_NAME_ALIASES),
          company: valueFor(row, COMPANY_ALIASES),
          emails: uniqueEmails(extractEmails(valueFor(row, CLIENT_EMAIL_ALIASES))),
        });
      });
    });

  return matches.find((match) => normalizeKey(match.project) === targetKey && match.emails.length) ||
    matches.find((match) => match.emails.length) ||
    null;
}

function rowToContact(row) {
  const email = valueFor(row, CLIENT_EMAIL_ALIASES);
  return {
    project: valueFor(row, PROJECT_ALIASES),
    clientName: valueFor(row, CLIENT_NAME_ALIASES),
    company: valueFor(row, COMPANY_ALIASES),
    email,
    phone: valueFor(row, PHONE_ALIASES),
    address: valueFor(row, ADDRESS_ALIASES),
    projectDetails: valueFor(row, PROJECT_DETAILS_ALIASES),
    payScheme: valueFor(row, PAY_SCHEME_ALIASES),
    charges: valueFor(row, CHARGES_ALIASES),
    status: valueFor(row, STATUS_ALIASES),
    emails: uniqueEmails(extractEmails(email)),
  };
}

function getContactsFromWorkbook(workbook) {
  const contacts = [];

  workbook.sheets
    .filter((sheet) => CLIENT_SHEET_CANDIDATES.some((name) => normalizeKey(sheet.title) === normalizeKey(name)))
    .forEach((sheet) => {
      const table = rowsToObjectsWithDetectedHeader(sheet, [PROJECT_ALIASES, CLIENT_EMAIL_ALIASES]);
      table.rows.forEach((row) => {
        const contact = rowToContact(row);
        if (!contact.project && !contact.clientName && !contact.email && !contact.company) return;
        contacts.push(contact);
      });
    });

  return contacts.sort((a, b) => (a.project || a.clientName || "").localeCompare(b.project || b.clientName || ""));
}

function coachingRequiredGroups() {
  return [[...TEAM_MEMBER_ALIASES, ...EMAIL_ALIASES, ...FULL_NAME_ALIASES, ...NAME_ALIASES]];
}

function coachingMatchesMember(row, member) {
  return memberMatchesRow(row, member);
}

function rowToCoaching(row) {
  const acknowledgedValue = valueFor(row, ACKNOWLEDGED_ALIASES);
  const status = valueFor(row, STATUS_ALIASES);
  const acknowledgedAt = valueFor(row, ACKNOWLEDGED_AT_ALIASES);
  const acknowledged = /^(true|yes|y|acknowledged|done)$/i.test(acknowledgedValue) ||
    /acknowledged/i.test(status) ||
    Boolean(acknowledgedAt);

  return {
    id: valueFor(row, COACHING_ID_ALIASES) || `row-${row.rowNumber}`,
    rowNumber: row.rowNumber,
    date: valueFor(row, DATE_ALIASES) || valueFor(row, CREATED_AT_ALIASES),
    teamMember: valueFor(row, TEAM_MEMBER_ALIASES) || valueFor(row, NAME_ALIASES),
    coach: valueFor(row, COACH_ALIASES),
    type: valueFor(row, COACHING_TYPE_ALIASES),
    topic: valueFor(row, TOPIC_ALIASES),
    notes: valueFor(row, NOTES_ALIASES),
    actionPlan: valueFor(row, ACTION_PLAN_ALIASES),
    status,
    acknowledged,
    acknowledgedAt,
  };
}

function getCoachingFromWorkbook(workbook, member) {
  const sheet = findSheetByTitle(workbook, COACHING_SHEET_CANDIDATES);
  if (!sheet) return [];

  const table = rowsToObjectsWithDetectedHeader(sheet, coachingRequiredGroups());
  return table.rows
    .filter((row) => coachingMatchesMember(row, member))
    .map(rowToCoaching)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

async function getContacts({ username, email, password }) {
  const { workbook } = await loadAuthenticatedMember({ username, email, password });
  return { contacts: getContactsFromWorkbook(workbook) };
}

async function getCoaching({ username, email, password }) {
  const { workbook, member } = await loadAuthenticatedMember({ username, email, password });
  return { coaching: getCoachingFromWorkbook(workbook, member) };
}

async function acknowledgeCoaching({ username, email, password, coachingId, rowNumber }) {
  const { member } = await loadAuthenticatedMember({ username, email, password });
  const table = await loadDetectedSheetTable(COACHING_SHEET_CANDIDATES, coachingRequiredGroups(), "A1:Z10000");
  const targetRowNumber = Number(rowNumber || String(coachingId || "").replace(/^row-/i, ""));
  const targetId = normalizeValue(coachingId);
  const row = table.rows.find((item) => {
    if (!coachingMatchesMember(item, member)) return false;
    const itemId = valueFor(item, COACHING_ID_ALIASES) || `row-${item.rowNumber}`;
    return (targetId && itemId === targetId) || (targetRowNumber && item.rowNumber === targetRowNumber);
  });

  if (!row) {
    const error = new Error("Coaching record was not found for this employee.");
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();
  await updateExistingRowFields(table.title, row.rowNumber, table.headers, [
    { aliases: ACKNOWLEDGED_ALIASES, value: "TRUE" },
    { aliases: ACKNOWLEDGED_AT_ALIASES, value: now },
    { aliases: STATUS_ALIASES, value: "Acknowledged" },
    { aliases: UPDATED_AT_ALIASES, value: now },
  ]);

  return {
    message: "Coaching acknowledged.",
    coaching: {
      ...rowToCoaching(row),
      acknowledged: true,
      acknowledgedAt: now,
      status: "Acknowledged",
    },
  };
}

function resolvePersonEmails(workbook, directEmailValue, identityValue) {
  const direct = extractEmails(directEmailValue);
  const embedded = extractEmails(identityValue);
  const identity = normalizeValue(identityValue).replace(/[<([]?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[>\])]?/gi, "").trim();
  const row = findEmployeeByIdentity(workbook, identity || identityValue);
  const fromEmployee = row ? extractEmails(valueFor(row, EMAIL_ALIASES)) : [];
  return uniqueEmails([...direct, ...embedded, ...fromEmployee]);
}

function resolveClockInRecipients(workbook, member, projectName) {
  const client = findClientForProject(workbook, projectName);
  const coachFallback = emailsFromEnv("JCIT_TITO_DEFAULT_COACH_EMAILS", DEFAULT_COACH_EMAILS);
  const managerFallback = emailsFromEnv("JCIT_TITO_DEFAULT_MANAGER_EMAILS", DEFAULT_MANAGER_EMAILS);

  return {
    client: {
      label: client?.clientName || client?.company || "Client",
      emails: client?.emails || [],
    },
    manager: {
      label: member.manager || "Manager",
      emails: uniqueEmails([
        ...resolvePersonEmails(workbook, member.managerEmail, member.manager),
        ...managerFallback,
      ]),
    },
    coach: {
      label: member.coach || "Coach",
      emails: uniqueEmails([
        ...resolvePersonEmails(workbook, member.coachEmail, member.coach),
        ...coachFallback,
      ]),
    },
  };
}

function safeMember(member) {
  return {
    username: member.username,
    name: member.name,
    teamMember: member.teamMember,
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

function formatSheetDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHEET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatSheetTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SHEET_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function timeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(byType.year),
    Number(byType.month) - 1,
    Number(byType.day),
    Number(byType.hour),
    Number(byType.minute),
    Number(byType.second)
  );

  return zonedAsUtc - date.getTime();
}

function parseTimeParts(value) {
  const text = normalizeValue(value);
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const second = Number(match[3] || 0);
  const meridiem = String(match[4] || "").toUpperCase();

  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (hour > 23 || minute > 59 || second > 59) return null;

  return { hour, minute, second };
}

function sheetDateTimeToIso(dateValue, timeValue) {
  const date = dateKey(dateValue) || normalizeValue(dateValue);
  const time = normalizeValue(timeValue);
  if (!time) return "";

  const timeParts = parseTimeParts(time);
  if (date && timeParts) {
    const [year, month, day] = date.split("-").map(Number);
    const wallClockUtc = Date.UTC(year, month - 1, day, timeParts.hour, timeParts.minute, timeParts.second);
    const firstPass = new Date(wallClockUtc - timeZoneOffsetMs(new Date(wallClockUtc), SHEET_TIME_ZONE));
    const offset = timeZoneOffsetMs(firstPass, SHEET_TIME_ZONE);
    return new Date(wallClockUtc - offset).toISOString();
  }

  const parsed = Date.parse(date ? `${date} ${time}` : time);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : time;
}

function findActiveShiftInTable(table, member) {
  if (!table) return null;
  const lookingForJay = isManagementMember(member.teamMember || member.name || member.username);

  for (let index = table.rows.length - 1; index >= 0; index -= 1) {
    const row = table.rows[index];
    const timeOut = valueFor(row, TIME_OUT_ALIASES);
    const status = valueFor(row, STATUS_ALIASES).toLowerCase();
    const closedStatuses = ["closed", "complete", "completed", "time out", "timed out", "out"];
    const activity = valueFor(row, ACTIVITY_ALIASES).toLowerCase();
    const notes = valueFor(row, NOTES_ALIASES);

    if (!memberMatchesRow(row, member)) continue;
    if (timeOut || closedStatuses.includes(status)) continue;
    if (lookingForJay && activity === "management" && notes) continue;

    return {
      rowNumber: row.rowNumber,
      entryId: valueFor(row, ENTRY_ID_ALIASES) || row.raw[0] || "",
      username: valueFor(row, USERNAME_ALIASES) || member.username,
      teamMember: valueFor(row, TEAM_MEMBER_ALIASES) || valueFor(row, NAME_ALIASES) || member.teamMember || member.name,
      project: valueFor(row, PROJECT_ALIASES),
      activity: valueFor(row, ACTIVITY_ALIASES),
      timeIn: sheetDateTimeToIso(valueFor(row, DATE_ALIASES), valueFor(row, TIME_IN_ALIASES)),
      notes,
      createdAt: valueFor(row, CREATED_AT_ALIASES),
    };
  }

  return null;
}

function isManagementMember(value) {
  return normalizeValue(value).toLowerCase() === "jay";
}

function nextLogNumber(table) {
  let max = 1000;
  if (!table || !Array.isArray(table.rows)) return max + 1;

  table.rows.forEach((row) => {
    const id = valueFor(row, ENTRY_ID_ALIASES) || row.raw?.[0] || "";
    const match = String(id).trim().match(/^LOG-(\d+)$/i);
    if (!match) return;
    const number = Number(match[1]);
    if (Number.isFinite(number)) max = Math.max(max, number);
  });

  return max + 1;
}

function durationFormula(headers, rowNumber) {
  const timeInIndex = findHeaderIndex(headers, TIME_IN_ALIASES);
  const timeOutIndex = findHeaderIndex(headers, TIME_OUT_ALIASES);
  if (timeInIndex === -1 || timeOutIndex === -1) return "";
  return `=(${columnLetter(timeOutIndex)}${rowNumber}-${columnLetter(timeInIndex)}${rowNumber})*24`;
}

function findOpenManagementShift(table, activeShift) {
  if (!table || !activeShift) return null;
  const entryId = normalizeValue(activeShift.entryId).toLowerCase();
  const project = normalizeValue(activeShift.project).toLowerCase();
  const closedStatuses = ["closed", "complete", "completed", "time out", "timed out", "out"];

  for (let index = table.rows.length - 1; index >= 0; index -= 1) {
    const row = table.rows[index];
    const teamMember = valueFor(row, TEAM_MEMBER_ALIASES) || valueFor(row, NAME_ALIASES);
    const timeOut = valueFor(row, TIME_OUT_ALIASES);
    const status = valueFor(row, STATUS_ALIASES).toLowerCase();
    const notes = valueFor(row, NOTES_ALIASES).toLowerCase();

    if (!isManagementMember(teamMember)) continue;
    if (timeOut || closedStatuses.includes(status)) continue;
    if (entryId && notes === entryId) {
      return { rowNumber: row.rowNumber, entryId: valueFor(row, ENTRY_ID_ALIASES) || row.raw[0] || "" };
    }
  }

  if (!project) return null;
  for (let index = table.rows.length - 1; index >= 0; index -= 1) {
    const row = table.rows[index];
    const teamMember = valueFor(row, TEAM_MEMBER_ALIASES) || valueFor(row, NAME_ALIASES);
    const rowProject = valueFor(row, PROJECT_ALIASES).toLowerCase();
    const timeOut = valueFor(row, TIME_OUT_ALIASES);
    const status = valueFor(row, STATUS_ALIASES).toLowerCase();

    if (!isManagementMember(teamMember)) continue;
    if (timeOut || closedStatuses.includes(status)) continue;
    if (rowProject === project) {
      return { rowNumber: row.rowNumber, entryId: valueFor(row, ENTRY_ID_ALIASES) || row.raw[0] || "" };
    }
  }

  return null;
}

async function findActiveShift(member) {
  const table = await loadExistingSheetTable(TIME_SHEET, "A1:Z10000", { required: false });
  return findActiveShiftInTable(table, member);
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

async function authenticate({ username, email, password }) {
  const { workbook, member } = await loadAuthenticatedMember({ username, email, password });
  const settings = getSettingsOptions(workbook);
  const projects = [...new Set([...settings.projects, ...getProjectsForMember(workbook, member)])].sort((a, b) =>
    a.localeCompare(b)
  );
  const activeShift = await findActiveShift(member);

  return {
    member: safeMember(member),
    projects,
    activities: settings.activities,
    contacts: getContactsFromWorkbook(workbook),
    coaching: getCoachingFromWorkbook(workbook, member),
    activeShift,
    payPeriod: getPayPeriod(),
  };
}

async function clockAction({ username, email, password, action, project, activity, notes }) {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const projectName = normalizeValue(project);
  const activityName = normalizeValue(activity) || "Client Work";
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

  const { workbook, member: authenticatedMember } = await loadAuthenticatedMember({ username, email, password });
  const member = safeMember(authenticatedMember);
  const memberEmail = member.email || (String(member.username).includes("@") ? member.username : "");
  const timeTable = await loadExistingSheetTable(TIME_SHEET, "A1:Z10000");
  requireHeaderGroups(timeTable.headers, [
    { label: "employee identity", options: [USERNAME_ALIASES, EMAIL_ALIASES, NAME_ALIASES] },
    { label: "project", options: [PROJECT_ALIASES] },
    { label: "time in", options: [TIME_IN_ALIASES] },
    { label: "time out", options: [TIME_OUT_ALIASES] },
  ], TIME_SHEET);
  const activeShift = findActiveShiftInTable(timeTable, member);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const sheetDate = formatSheetDate(nowDate);
  const sheetTime = formatSheetTime(nowDate);

  if (normalizedAction === "time_in") {
    if (activeShift) {
      const error = new Error("You are already clocked in.");
      error.statusCode = 409;
      throw error;
    }

    const logNumber = nextLogNumber(timeTable);
    const entryId = `LOG-${logNumber}`;
    const managementEntryId = `LOG-${logNumber + 1}`;
    const teamMember = member.teamMember || member.name;
    const baseAssignments = [
      { aliases: ENTRY_ID_ALIASES, value: entryId },
      { aliases: DATE_ALIASES, value: sheetDate },
      { aliases: USERNAME_ALIASES, value: member.username },
      { aliases: EMAIL_ALIASES, value: memberEmail },
      { aliases: FULL_NAME_ALIASES, value: member.name },
      { aliases: TEAM_MEMBER_ALIASES, value: teamMember },
      { aliases: PROJECT_ALIASES, value: projectName },
      { aliases: ACTIVITY_ALIASES, value: activityName },
      { aliases: TIME_IN_ALIASES, value: sheetTime },
      { aliases: TIME_OUT_ALIASES, value: "" },
      { aliases: HOURS_ALIASES, value: "" },
      { aliases: STATUS_ALIASES, value: "Open" },
      { aliases: NOTES_ALIASES, value: normalizeValue(notes) },
      { aliases: CREATED_AT_ALIASES, value: now },
      { aliases: UPDATED_AT_ALIASES, value: now },
    ];
    const entries = [buildAppendRow(timeTable.headers, baseAssignments, TIME_SHEET)];
    const hasManagementPair = !isManagementMember(teamMember);

    if (hasManagementPair) {
      entries.push(buildAppendRow(timeTable.headers, [
        { aliases: ENTRY_ID_ALIASES, value: managementEntryId },
        { aliases: DATE_ALIASES, value: sheetDate },
        { aliases: TEAM_MEMBER_ALIASES, value: "Jay" },
        { aliases: PROJECT_ALIASES, value: projectName },
        { aliases: ACTIVITY_ALIASES, value: "Management" },
        { aliases: TIME_IN_ALIASES, value: sheetTime },
        { aliases: TIME_OUT_ALIASES, value: "" },
        { aliases: HOURS_ALIASES, value: "" },
        { aliases: STATUS_ALIASES, value: "Open" },
        { aliases: NOTES_ALIASES, value: entryId },
        { aliases: CREATED_AT_ALIASES, value: now },
        { aliases: UPDATED_AT_ALIASES, value: now },
      ], TIME_SHEET));
    }

    await appendValues(TIME_SHEET, entries);

    const emailStatus = await sendClockInNotifications({
      workbook,
      member: authenticatedMember,
      projectName,
      activityName,
      notes: normalizeValue(notes),
      entryId,
      timeIn: now,
    });
    const notificationSent = emailStatus.sentToClient || emailStatus.sentToManager || emailStatus.sentToCoach;

    return {
      message: emailStatus.failed
        ? "Time in saved. Some notifications could not be sent."
        : notificationSent
          ? "Time in saved. Notifications sent."
          : "Time in saved.",
      activeShift: {
        entryId,
        managementEntryId: hasManagementPair ? managementEntryId : "",
        username: member.username,
        teamMember,
        project: projectName,
        activity: activityName,
        timeIn: now,
        notes: normalizeValue(notes),
        createdAt: now,
      },
      emailStatus,
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
  const totalHoursValue = durationFormula(timeTable.headers, activeShift.rowNumber) || totalHours;
  const managementShift = isManagementMember(member.teamMember || member.name)
    ? null
    : findOpenManagementShift(timeTable, activeShift);

  await updateExistingRowFields(TIME_SHEET, activeShift.rowNumber, timeTable.headers, [
    { aliases: TIME_OUT_ALIASES, value: sheetTime },
    { aliases: HOURS_ALIASES, value: totalHoursValue },
    { aliases: STATUS_ALIASES, value: "Closed" },
    { aliases: NOTES_ALIASES, value: finalNotes },
    { aliases: CREATED_AT_ALIASES, value: createdAt },
    { aliases: UPDATED_AT_ALIASES, value: now },
  ]);

  if (managementShift) {
    await updateExistingRowFields(TIME_SHEET, managementShift.rowNumber, timeTable.headers, [
      { aliases: TIME_OUT_ALIASES, value: sheetTime },
      { aliases: HOURS_ALIASES, value: durationFormula(timeTable.headers, managementShift.rowNumber) || totalHours },
      { aliases: STATUS_ALIASES, value: "Closed" },
      { aliases: UPDATED_AT_ALIASES, value: now },
    ]);
  }

  return {
    message: managementShift
      ? `Time out saved. Total hours: ${totalHours}. Management session was also finalized.`
      : `Time out saved. Total hours: ${totalHours}.`,
    activeShift: null,
  };
}

async function submitLeave({
  username,
  email,
  password,
  leaveType,
  startDate,
  endDate,
  reason,
  clientProject,
  clientApproval,
  notifyClient,
  autoLogTime,
  proof,
}) {
  const type = normalizeValue(leaveType);
  if (!["Vacation", "Sick", "Emergency"].includes(type)) {
    const error = new Error("Leave type must be Vacation, Sick, or Emergency.");
    error.statusCode = 400;
    throw error;
  }

  const days = dayCount(startDate, endDate);
  const session = await authenticate({ username, email, password });
  const member = session.member;
  const memberEmail = member.email || (String(member.username).includes("@") ? member.username : "");
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const requestDate = formatSheetDate(nowDate);
  const requestId = makeId("LEAVE");
  const clientApprovalStatus = normalizeValue(clientApproval) || "Pending";
  const proofFile = await uploadProofFile(proof, member);
  const leaveTable = await loadExistingSheetTable(LEAVE_SHEET, "A1:Z10000");
  requireHeaderGroups(leaveTable.headers, [
    { label: "employee identity", options: [TEAM_MEMBER_ALIASES, NAME_ALIASES] },
    { label: "leave type", options: [LEAVE_TYPE_ALIASES] },
    { label: "start date", options: [START_DATE_ALIASES] },
    { label: "end date", options: [END_DATE_ALIASES] },
  ], LEAVE_SHEET);

  const leaveRow = buildAppendRow(leaveTable.headers, [
    { aliases: REQUEST_ID_ALIASES, value: requestId },
    { aliases: CREATED_AT_ALIASES, value: requestDate },
    { aliases: USERNAME_ALIASES, value: member.username },
    { aliases: EMAIL_ALIASES, value: memberEmail },
    { aliases: FULL_NAME_ALIASES, value: member.name },
    { aliases: TEAM_MEMBER_ALIASES, value: member.teamMember || member.name },
    { aliases: LEAVE_TYPE_ALIASES, value: type },
    { aliases: START_DATE_ALIASES, value: startDate },
    { aliases: END_DATE_ALIASES, value: endDate },
    { aliases: DAY_COUNT_ALIASES, value: days },
    { aliases: CLIENT_PROJECT_ALIASES, value: normalizeValue(clientProject) },
    { aliases: PROOF_ALIASES, value: proofFile?.url ? hyperlinkFormula(proofFile.url, "View proof") : "" },
    { aliases: REASON_ALIASES, value: normalizeValue(reason) },
    { aliases: CLIENT_APPROVAL_ALIASES, value: clientApprovalStatus },
    { aliases: MANAGER_STATUS_ALIASES, value: "Pending" },
    { aliases: NOTIFY_CLIENT_ALIASES, value: notifyClient ? "TRUE" : "FALSE" },
    { aliases: AUTO_LOG_TIME_ALIASES, value: autoLogTime ? "TRUE" : "FALSE" },
    { aliases: REVIEWED_BY_ALIASES, value: "" },
    { aliases: REVIEWED_AT_ALIASES, value: "" },
    { aliases: NOTES_ALIASES, value: "" },
  ], LEAVE_SHEET);

  await appendValues(LEAVE_SHEET, [leaveRow]);

  const emailStatus = await sendLeaveEmails({
    requestId,
    member,
    leaveType: type,
    startDate,
    endDate,
    days,
    reason: normalizeValue(reason),
    clientApproval: clientApprovalStatus,
    clientProject: normalizeValue(clientProject),
    proofUrl: proofFile?.url || "",
  });

  const notificationMessage =
    emailStatus.sentToEmployee || emailStatus.sentToAdmin
      ? "Leave request submitted and notifications sent."
      : "Leave request submitted. Email notifications are not configured yet.";

  return {
    message: notificationMessage,
    request: {
      id: requestId,
      leaveType: type,
      startDate,
      endDate,
      days,
      status: "Pending",
      proofUrl: proofFile?.url || "",
    },
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
    replyTo: TITO_REPLY_TO_EMAIL,
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEmailDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return normalizeValue(value) || "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SHEET_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function clockInEmailContent({ audience, member, projectName, activityName, notes, entryId, timeIn, recipientLabel }) {
  const isClient = audience === "client";
  const subject = isClient
    ? `JCIT update: ${member.name} logged in for ${projectName}`
    : `JCIT TiTo time-in: ${member.name} - ${projectName}`;
  const intro = isClient
    ? `${member.name} from JCIT Services has logged in for the assigned project.`
    : `${member.name} has started a TiTo session.`;
  const rows = [
    ["Team Member", member.name || member.teamMember || member.email],
    ["Email", member.email || "-"],
    ["Project", projectName],
    ["Activity", activityName],
    ["Time In", formatEmailDateTime(timeIn)],
    ["Log ID", entryId],
    ["Notes", notes || "-"],
  ];
  const text = [
    `Hi ${recipientLabel || "there"},`,
    "",
    intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#102331;">
      <p>Hi ${escapeHtml(recipientLabel || "there")},</p>
      <p>${escapeHtml(intro)}</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;border:1px solid #dce8ee;">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <th style="text-align:left;padding:10px;border-bottom:1px solid #dce8ee;background:#f5fafc;">${escapeHtml(label)}</th>
                <td style="padding:10px;border-bottom:1px solid #dce8ee;">${escapeHtml(value || "-")}</td>
              </tr>`
          )
          .join("")}
      </table>
    </div>
  `.trim();
  return { subject, text, html };
}

async function sendClockInNotification({ role, recipients, content }) {
  if (!recipients.length) {
    return { sent: false, skipped: true, failed: false, count: 0, role, reason: `No ${role} recipient found.` };
  }

  try {
    const result = await sendResendEmail({ to: recipients, ...content });
    return {
      sent: Boolean(result.sent),
      skipped: Boolean(result.skipped),
      failed: false,
      count: recipients.length,
      role,
      reason: result.reason || "",
    };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      failed: true,
      count: recipients.length,
      role,
      reason: error.message,
    };
  }
}

async function sendClockInNotifications({ workbook, member, projectName, activityName, notes, entryId, timeIn }) {
  const recipients = resolveClockInRecipients(workbook, member, projectName);
  const results = await Promise.all(
    ["client", "manager", "coach"].map((role) =>
      sendClockInNotification({
        role,
        recipients: recipients[role].emails,
        content: clockInEmailContent({
          audience: role,
          member,
          projectName,
          activityName,
          notes,
          entryId,
          timeIn,
          recipientLabel: recipients[role].label,
        }),
      })
    )
  );
  const byRole = Object.fromEntries(results.map((result) => [result.role, result]));

  return {
    sentToClient: Boolean(byRole.client?.sent),
    sentToManager: Boolean(byRole.manager?.sent),
    sentToCoach: Boolean(byRole.coach?.sent),
    failed: results.some((result) => result.failed),
    skipped: results.every((result) => result.skipped),
    recipientCounts: {
      client: byRole.client?.count || 0,
      manager: byRole.manager?.count || 0,
      coach: byRole.coach?.count || 0,
    },
  };
}

function leaveEmailContent({
  requestId,
  member,
  leaveType,
  startDate,
  endDate,
  days,
  reason,
  clientApproval,
  clientProject,
  proofUrl,
}) {
  const subject = `JCIT leave request: ${member.name} (${leaveType})`;
  const text = [
    `Leave request ${requestId}`,
    `Employee: ${member.name} (${member.username})`,
    `Email: ${member.email || "Not listed"}`,
    `Leave type: ${leaveType}`,
    `Dates: ${startDate} to ${endDate} (${days} day/s)`,
    `Client / Project: ${clientProject || "-"}`,
    `Client approval: ${clientApproval}`,
    `Proof: ${proofUrl || "-"}`,
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
          ["Client / Project", clientProject || "-"],
          ["Client Approval", clientApproval],
          ["Proof", proofUrl ? `<a href="${proofUrl}">View proof</a>` : "-"],
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

function employeeLeaveConfirmation({ requestId, member, leaveType, startDate, endDate, days, clientApproval, clientProject }) {
  const subject = `JCIT leave request received: ${requestId}`;
  const text = [
    `Hi ${member.name},`,
    "",
    "Your leave request has been received.",
    `Leave type: ${leaveType}`,
    `Dates: ${startDate} to ${endDate} (${days} day/s)`,
    `Client / Project: ${clientProject || "-"}`,
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
        <li><strong>Client / Project:</strong> ${clientProject || "-"}</li>
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

function passwordEmailContent(member) {
  const subject = "JCIT TiTo password assistance";
  const text = [
    `Hi ${member.name},`,
    "",
    "We received a password assistance request for your JCIT TiTo account.",
    `Email: ${member.email}`,
    `Current portal password: ${member.portalPassword || "Not listed"}`,
    "",
    "If you did not request this, please notify JL or Jake.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#102331;">
      <p>Hi ${member.name},</p>
      <p>We received a password assistance request for your JCIT TiTo account.</p>
      <table style="border-collapse:collapse;width:100%;max-width:520px;border:1px solid #dce8ee;">
        <tr>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #dce8ee;background:#f5fafc;">Email</th>
          <td style="padding:10px;border-bottom:1px solid #dce8ee;">${member.email}</td>
        </tr>
        <tr>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #dce8ee;background:#f5fafc;">Current portal password</th>
          <td style="padding:10px;border-bottom:1px solid #dce8ee;">${member.portalPassword || "Not listed"}</td>
        </tr>
      </table>
      <p>If you did not request this, please notify JL or Jake.</p>
    </div>
  `.trim();
  return { subject, text, html };
}

async function requestPasswordEmail({ email }) {
  const genericMessage = "If that email is listed in Employees, password instructions will be sent.";
  const workbook = await loadWorkbook();
  const member = findMemberByEmail(workbook, email);

  if (!member || !member.email || !member.portalPassword) {
    return {
      message: genericMessage,
      emailStatus: { sentToEmployee: false, skipped: true },
    };
  }

  const employeeResult = await sendResendEmail({
    to: member.email,
    ...passwordEmailContent(member),
  });

  return {
    message: employeeResult.sent
      ? "Password instructions were sent to your email."
      : "Password instructions could not be emailed yet because email notifications are not configured.",
    emailStatus: {
      sentToEmployee: Boolean(employeeResult.sent),
      skipped: Boolean(employeeResult.skipped),
    },
  };
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
  const identities = [member.username, member.email, member.name, member.teamMember]
    .filter(Boolean)
    .map((item) => item.toLowerCase());
  const rowIdentities = [
    valueFor(row, USERNAME_ALIASES),
    valueFor(row, EMAIL_ALIASES),
    valueFor(row, FULL_NAME_ALIASES),
    valueFor(row, TEAM_MEMBER_ALIASES),
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

function extractHyperlinkFormula(value) {
  const formula = normalizeValue(value);
  const match = formula.match(/^=HYPERLINK\("((?:""|[^"])*)"/i);
  if (match) return match[1].replace(/""/g, '"');
  const urlMatch = formula.match(/https?:\/\/[^\s")]+/i);
  return urlMatch ? urlMatch[0] : "";
}

function rowToPayslip(row, formulaRow) {
  const hidden = new Set(["password", "passcode", "pin", "password hash", "password_hash"]);
  const lines = row.headers
    .filter((header) => !hidden.has(header.toLowerCase()))
    .map((header) => ({
      label: header,
      value: row.values[header],
    }))
    .filter((line) => line.value !== "");
  const fileUrl =
    (formulaRow ? extractHyperlinkFormula(valueFor(formulaRow, PAYSLIP_FILE_ALIASES)) : "") ||
    extractHyperlinkFormula(valueFor(row, PAYSLIP_FILE_ALIASES));

  return {
    sourceSheet: row.sheetName,
    rowNumber: row.rowNumber,
    fileUrl,
    fileLabel: valueFor(row, PAYSLIP_FILE_ALIASES) || (fileUrl ? "Open payslip PDF" : ""),
    payDate: valueFor(row, PAY_DATE_ALIASES),
    coverage: valueFor(row, COVERAGE_ALIASES),
    coverageStart: valueFor(row, COVERAGE_START_ALIASES),
    coverageEnd: valueFor(row, COVERAGE_END_ALIASES),
    lines,
  };
}

function sortPayslips(payslips) {
  return payslips.sort((a, b) => {
    const aDate = dateKey(a.payDate || a.coverageEnd || a.coverageStart);
    const bDate = dateKey(b.payDate || b.coverageEnd || b.coverageStart);
    return String(bDate || b.rowNumber).localeCompare(String(aDate || a.rowNumber));
  });
}

async function getPayslip({ username, email, password }) {
  const session = await authenticate({ username, email, password });
  const workbook = await loadWorkbook();
  const sheet = findSheetByTitle(workbook, PAYSLIP_SHEET_CANDIDATES);
  const period = getPayPeriod();

  if (!sheet) {
    const error = new Error("Payslip tab was not found in the Google Sheet.");
    error.statusCode = 404;
    throw error;
  }

  const table = rowsToObjects(sheet);
  const formulaTable = rowsToObjects({
    title: sheet.title,
    values: await getValues(sheet.title, "A1:Z1000", "FORMULA"),
  });
  const memberRows = table.rows.filter((row) => memberMatchesRow(row, session.member));
  if (!memberRows.length) {
    const error = new Error("No payslip row found for this employee.");
    error.statusCode = 404;
    throw error;
  }

  const matchedRow = memberRows.find((row) => periodMatchesRow(row, period)) || memberRows[memberRows.length - 1];
  const matchedFormulaRow = formulaTable.rows.find((row) => row.rowNumber === matchedRow.rowNumber);
  const payslips = sortPayslips(memberRows.map((row) =>
    rowToPayslip(row, formulaTable.rows.find((formulaRow) => formulaRow.rowNumber === row.rowNumber))
  ));

  return {
    member: session.member,
    payPeriod: period,
    payslip: rowToPayslip(matchedRow, matchedFormulaRow),
    payslips,
  };
}

module.exports = {
  authenticate,
  clockAction,
  submitLeave,
  getPayslip,
  getContacts,
  getCoaching,
  acknowledgeCoaching,
  requestPasswordEmail,
  getPayPeriod,
  getConfiguredSpreadsheetId,
};

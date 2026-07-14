const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

const DEFAULT_SPREADSHEET_ID = "1OVZGnLAHtk5QVEyZmD_vxvC8IoAxCxPHq2nJAw5TyjA";
const HEADERS = [
  "Submitted At",
  "Name",
  "Email Address",
  "Phone Number",
  "Position",
  "Source",
  "Privacy Consent",
  "Status",
];

let cachedToken = null;

function getConfig() {
  const config = {
    spreadsheetId: String(process.env.JCIT_TALENT_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID).trim(),
    clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(),
    refreshToken: String(process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "").trim(),
  };

  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    const error = new Error("Google Sheets OAuth is not configured.");
    error.statusCode = 503;
    throw error;
  }

  return config;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const config = getConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const error = new Error(data.error_description || data.error || "Google OAuth refresh failed.");
    error.statusCode = 502;
    throw error;
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

async function sheetsRequest(path, options = {}) {
  const config = getConfig();
  const token = await getAccessToken();
  const response = await fetch(`${GOOGLE_SHEETS_API}/${config.spreadsheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || "Google Sheets request failed.");
    error.statusCode = response.status === 403 ? 503 : 502;
    throw error;
  }
  return data;
}

function quoteSheetName(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function safeSheetValue(value) {
  const normalized = String(value || "").trim();
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

async function getFirstVisibleSheet() {
  const metadata = await sheetsRequest("?fields=sheets.properties(sheetId,title,index,hidden)");
  const sheets = Array.isArray(metadata.sheets) ? metadata.sheets : [];
  const target = sheets
    .map((sheet) => sheet.properties)
    .filter((sheet) => !sheet.hidden)
    .sort((a, b) => a.index - b.index)[0];

  if (!target) {
    const error = new Error("The talent spreadsheet has no visible sheet tab.");
    error.statusCode = 503;
    throw error;
  }
  return target;
}

async function ensureHeaders(sheetTitle) {
  const sheet = quoteSheetName(sheetTitle);
  const current = await sheetsRequest(
    `/values/${encodeURIComponent(`${sheet}!A1:H1`)}?majorDimension=ROWS`
  );
  const row = current.values?.[0] || [];

  if (row.some((value) => String(value || "").trim())) return;

  await sheetsRequest(
    `/values/${encodeURIComponent(`${sheet}!A1:H1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ range: `${sheet}!A1:H1`, majorDimension: "ROWS", values: [HEADERS] }),
    }
  );
}

async function appendTalentSignup({ submittedAt, name, email, phone, position, source }) {
  const target = await getFirstVisibleSheet();
  await ensureHeaders(target.title);
  const sheet = quoteSheetName(target.title);
  const row = [
    submittedAt,
    safeSheetValue(name),
    safeSheetValue(email),
    safeSheetValue(phone),
    safeSheetValue(position),
    safeSheetValue(source),
    "Yes",
    "Talent Pool",
  ];

  return sheetsRequest(
    `/values/${encodeURIComponent(`${sheet}!A:H`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ range: `${sheet}!A:H`, majorDimension: "ROWS", values: [row] }),
    }
  );
}

module.exports = { appendTalentSignup };

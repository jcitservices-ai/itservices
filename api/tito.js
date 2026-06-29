const {
  authenticate,
  acknowledgeCoaching,
  clockAction,
  getCoaching,
  getContacts,
  getPayslip,
  requestPasswordEmail,
  submitLeave,
  getConfiguredSpreadsheetId,
} = require("../lib/tito-sheet-store");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function setCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  const allowed = new Set([
    "https://jcit.digital",
    "https://www.jcit.digital",
    "http://127.0.0.1:8765",
    "http://localhost:8765",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ]);

  if (allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 6_000_000) {
      const error = new Error("Request too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseBody(req, raw) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) return JSON.parse(raw || "{}");
  const params = new URLSearchParams(raw || "");
  const fields = {};
  params.forEach((value, key) => {
    fields[key] = value;
  });
  return fields;
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      service: "JCIT TiTo",
      spreadsheetId: getConfiguredSpreadsheetId(),
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "Method not allowed." });
    return;
  }

  try {
    const body = parseBody(req, await readBody(req));
    const action = String(body.action || "").trim().toLowerCase();
    let result;

    if (action === "login") {
      result = await authenticate({
        username: body.username,
        email: body.email,
        password: body.password,
      });
    } else if (action === "clock") {
      result = await clockAction({
        username: body.username,
        email: body.email,
        password: body.password,
        action: body.clockAction,
        project: body.project,
        activity: body.activity,
        notes: body.notes,
      });
    } else if (action === "leave") {
      result = await submitLeave({
        username: body.username,
        email: body.email,
        password: body.password,
        leaveType: body.leaveType,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
        clientProject: body.clientProject,
        clientApproval: body.clientApproval,
        notifyClient: body.notifyClient,
        autoLogTime: body.autoLogTime,
        proof: body.proof,
      });
    } else if (action === "payslip") {
      result = await getPayslip({
        username: body.username,
        email: body.email,
        password: body.password,
      });
    } else if (action === "contacts") {
      result = await getContacts({
        username: body.username,
        email: body.email,
        password: body.password,
      });
    } else if (action === "coaching") {
      result = await getCoaching({
        username: body.username,
        email: body.email,
        password: body.password,
      });
    } else if (action === "acknowledge_coaching") {
      result = await acknowledgeCoaching({
        username: body.username,
        email: body.email,
        password: body.password,
        coachingId: body.coachingId,
        rowNumber: body.rowNumber,
      });
    } else if (action === "password_reset") {
      result = await requestPasswordEmail({
        email: body.email || body.username,
      });
    } else {
      const error = new Error("Unknown TiTo action.");
      error.statusCode = 400;
      throw error;
    }

    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode >= 500 && statusCode !== 503
        ? "TiTo could not reach the timekeeping sheet right now."
        : error.message;

    sendJson(res, statusCode, {
      ok: false,
      message,
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xreabold";
const SOURCE_LABEL = "jcit.digital/daddygrab (kickoff)";
const { verifyTurnstile } = require("./_turnstile");
const { forwardToFormspree } = require("./_formspree");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.end();
}

function wantsJson(req) {
  return String(req.headers.accept || "").toLowerCase().includes("application/json");
}

function setCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  const allowed = new Set([
    "https://jcit.digital",
    "https://www.jcit.digital",
    "http://127.0.0.1:8765",
    "http://localhost:8765",
  ]);

  if (allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || String(req.socket?.remoteAddress || "").trim();
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 200_000) {
      const error = new Error("Request too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseFields(req, raw) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) return JSON.parse(raw || "{}");
  const params = new URLSearchParams(raw || "");
  const fields = {};
  params.forEach((value, key) => {
    fields[key] = value;
  });
  return fields;
}

function getFormspreeEndpoint() {
  return String(process.env.JCIT_FORMSPREE_ENDPOINT || FORMSPREE_ENDPOINT).trim();
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "Method not allowed." });
    return;
  }

  try {
    const raw = await readBody(req);
    const fields = parseFields(req, raw);

    if (fields.company) {
      const location = String(fields._next || "https://jcit.digital/thank-you/").trim();
      if (wantsJson(req)) return sendJson(res, 200, { ok: true, redirect: location });
      return redirect(res, location);
    }

    await verifyTurnstile({
      token: fields["cf-turnstile-response"] || fields.turnstile_token,
      ip: getClientIp(req),
      secretKey: process.env.TURNSTILE_SECRET_KEY,
    });

    const nextUrl = String(fields._next || "https://jcit.digital/thank-you/").trim();
    const forwarded = { ...fields };
    delete forwarded.company;
    delete forwarded["cf-turnstile-response"];
    delete forwarded.turnstile_token;
    forwarded.source = SOURCE_LABEL;

    await forwardToFormspree({ endpoint: getFormspreeEndpoint(), fields: forwarded });

    if (wantsJson(req)) return sendJson(res, 200, { ok: true, redirect: nextUrl });
    redirect(res, nextUrl);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode >= 500
        ? "Request could not be submitted right now. Please try again later."
        : error.message;
    if (wantsJson(req)) return sendJson(res, statusCode, { ok: false, message });
    redirect(res, `https://jcit.digital/daddygrab/?kickoff=error&message=${encodeURIComponent(message)}`);
  }
};


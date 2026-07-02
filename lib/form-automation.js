const DEFAULT_FORMSPREE_ENDPOINT = "https://formspree.io/f/xreabold";
const DEFAULT_FROM_EMAIL = "JC IT Services <noreply@jcit.digital>";
const DEFAULT_REPLY_TO = "jake@jcit.digital";
const DEFAULT_NOTIFY_EMAIL = "jake@jcit.digital";
const MAX_URLENCODED_BYTES = 300_000;

const { verifyRecaptchaV2 } = require("./recaptcha");
const { forwardToFormspree } = require("./formspree");

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
  const accept = String(req.headers.accept || "").toLowerCase();
  const requestedWith = String(req.headers["x-requested-with"] || "").toLowerCase();
  return accept.includes("application/json") || requestedWith === "fetch";
}

function setCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  const allowed = new Set([
    "https://jcit.digital",
    "https://www.jcit.digital",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8765",
    "http://localhost:8765",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
  ]);

  if (allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
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
    if (total > MAX_URLENCODED_BYTES) {
      const error = new Error("Request is too large.");
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

function toSafeLine(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFormspreeEndpoint() {
  return String(process.env.JCIT_FORMSPREE_ENDPOINT || DEFAULT_FORMSPREE_ENDPOINT).trim();
}

function getEmailConfig(kind) {
  const namespace = kind === "career" ? "JCIT_RECRUITMENT" : "JCIT_LEADS";
  return {
    apiKey: String(process.env.RESEND_API_KEY || "").trim(),
    from: String(
      process.env[`${namespace}_FROM_EMAIL`] ||
        process.env.JCIT_CONTACT_FROM_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        DEFAULT_FROM_EMAIL
    ).trim(),
    replyTo: String(
      process.env[`${namespace}_REPLY_TO`] ||
        process.env.JCIT_CONTACT_REPLY_TO ||
        DEFAULT_REPLY_TO
    ).trim(),
    notifyEmail: String(
      process.env[`${namespace}_NOTIFY_EMAIL`] ||
        process.env.JCIT_NOTIFY_EMAIL ||
        DEFAULT_NOTIFY_EMAIL
    ).trim(),
  };
}

function getAutomationWebhookUrl(kind) {
  const namespace = kind === "career" ? "JCIT_RECRUITMENT" : "JCIT_LEADS";
  return String(
    process.env[`${namespace}_WEBHOOK_URL`] ||
      process.env.JCIT_FORM_WEBHOOK_URL ||
      process.env.JCIT_AUTOMATION_WEBHOOK_URL ||
      ""
  ).trim();
}

function scrubFields(fields) {
  const safe = { ...fields };
  delete safe.company;
  delete safe["g-recaptcha-response"];
  delete safe.recaptcha_token;
  return safe;
}

function buildRowsHtml(fields) {
  return Object.entries(fields)
    .filter(([key]) => !key.startsWith("_"))
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #dce6df;color:#52635d;font-weight:700;">${escapeHtml(key.replace(/_/g, " "))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #dce6df;color:#0b1614;">${escapeHtml(value || "N/A")}</td>
        </tr>`
    )
    .join("");
}

function buildInternalEmail({ title, source, fields }) {
  const subject = `${title} - ${toSafeLine(fields.name || fields.email || "New submission")}`;
  const text = [
    title,
    `Source: ${source}`,
    "",
    ...Object.entries(fields)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, value]) => `${key}: ${toSafeLine(value) || "N/A"}`),
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0b1614;background:#f5f7f1;padding:28px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dce6df;border-radius:12px;padding:24px;">
        <p style="margin:0 0 8px;color:#08766c;font-size:12px;text-transform:uppercase;font-weight:700;">JCIT Automation</p>
        <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 18px;color:#52635d;">Source: ${escapeHtml(source)}</p>
        <table style="border-collapse:collapse;width:100%;border:1px solid #dce6df;">${buildRowsHtml(fields)}</table>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

function buildAutoReply({ title, name, nextStep }) {
  const safeName = toSafeLine(name) || "there";
  const subject = `JCIT received your ${title.toLowerCase()}`;
  const text = [
    `Hi ${safeName},`,
    "",
    `Thanks for contacting JC IT Services. We received your ${title.toLowerCase()} and will review it against the right service lane.`,
    "",
    nextStep || "Expect a response within one business day.",
    "",
    "JC IT Services",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#020606;color:#f7fbf7;padding:32px;">
      <div style="max-width:640px;margin:0 auto;border:1px solid rgba(247,251,247,0.14);border-radius:12px;background:#081111;padding:28px;">
        <p style="margin:0 0 8px;color:#1de2cc;font-size:12px;text-transform:uppercase;font-weight:700;">JC IT Services</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;">We received your ${escapeHtml(title.toLowerCase())}</h1>
        <p style="margin:0 0 14px;color:#dfe9e4;">Hi ${escapeHtml(safeName)},</p>
        <p style="margin:0 0 14px;color:#b9c7c0;line-height:1.7;">Thanks for contacting JC IT Services. We will review your request and route it to the right service lane.</p>
        <p style="margin:0;color:#b9c7c0;line-height:1.7;">${escapeHtml(nextStep || "Expect a response within one business day.")}</p>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

async function sendResendEmail({ kind, to, subject, text, html, replyTo }) {
  const config = getEmailConfig(kind);
  if (!config.apiKey || !to) return { skipped: true, reason: "resend_not_configured" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: Array.isArray(to) ? to : [to],
      ...(replyTo || config.replyTo ? { reply_to: replyTo || config.replyTo } : {}),
      subject,
      text,
      html,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Resend failed with ${response.status}.`);
    error.statusCode = 502;
    error.serviceStatus = response.status;
    throw error;
  }
  return payload;
}

async function forwardToAutomationWebhook({ kind, payload }) {
  const url = getAutomationWebhookUrl(kind);
  if (!url) return { skipped: true, reason: "webhook_not_configured" };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(`Automation webhook failed with ${response.status}: ${body.slice(0, 180)}`);
    error.statusCode = 502;
    error.serviceStatus = response.status;
    throw error;
  }

  return response.json().catch(() => ({ ok: true }));
}

function validateRequired(fields, required) {
  for (const field of required) {
    if (!toSafeLine(fields[field])) {
      const error = new Error(`${field.replace(/_/g, " ")} is required.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (fields.email && !isEmail(normalizeEmail(fields.email))) {
    const error = new Error("A valid email address is required.");
    error.statusCode = 400;
    throw error;
  }
}

async function handleForm(req, res, options) {
  const {
    kind = "lead",
    title = "JCIT form submission",
    source = "jcit.digital",
    successUrl = "https://jcit.digital/thank-you/",
    errorUrl = "https://jcit.digital/contact/",
    required = ["name", "email"],
    autoReply = true,
    nextStep,
  } = options || {};

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
    const nextUrl = String(fields._next || successUrl).trim();

    if (fields.company) {
      if (wantsJson(req)) return sendJson(res, 200, { ok: true, redirect: nextUrl });
      return redirect(res, nextUrl);
    }

    await verifyRecaptchaV2({
      token: fields["g-recaptcha-response"] || fields.recaptcha_token,
      ip: getClientIp(req),
      secretKey: process.env.RECAPTCHA_SECRET_KEY,
    });

    validateRequired(fields, required);

    const cleanFields = scrubFields(fields);
    const normalized = {
      ...cleanFields,
      email: normalizeEmail(cleanFields.email),
      source,
      submitted_at: new Date().toISOString(),
    };
    const emailConfig = getEmailConfig(kind);
    const internalEmail = buildInternalEmail({ title, source, fields: normalized });
    const replyEmail = buildAutoReply({
      title,
      name: normalized.name,
      nextStep,
    });

    const tasks = [
      forwardToFormspree({
        endpoint: getFormspreeEndpoint(),
        fields: {
          ...normalized,
          _subject: fields._subject || title,
          _replyto: normalized.email,
        },
      }),
      sendResendEmail({
        kind,
        to: emailConfig.notifyEmail,
        replyTo: normalized.email || emailConfig.replyTo,
        ...internalEmail,
      }),
      forwardToAutomationWebhook({
        kind,
        payload: {
          type: kind,
          title,
          source,
          fields: normalized,
        },
      }),
    ];

    if (autoReply && normalized.email) {
      tasks.push(
        sendResendEmail({
          kind,
          to: normalized.email,
          ...replyEmail,
        })
      );
    }

    const results = await Promise.allSettled(tasks);
    const hardFailures = results.filter((result) => result.status === "rejected");
    const successes = results.filter(
      (result) => result.status === "fulfilled" && !result.value?.skipped
    );

    if (!successes.length && hardFailures.length) {
      throw hardFailures[0].reason;
    }

    hardFailures.forEach((result) => {
      console.error("[form-automation] delivery issue", {
        title,
        source,
        message: String(result.reason?.message || result.reason || "").slice(0, 400),
        statusCode: result.reason?.statusCode || null,
        serviceStatus: result.reason?.serviceStatus || null,
      });
    });

    if (wantsJson(req)) return sendJson(res, 200, { ok: true, redirect: nextUrl });
    redirect(res, nextUrl);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode >= 500
        ? "Request could not be submitted right now. Please try again later."
        : error.message;

    if (wantsJson(req)) return sendJson(res, statusCode, { ok: false, message });
    redirect(res, `${errorUrl}?form=error&message=${encodeURIComponent(message)}`);
  }
}

module.exports = {
  handleForm,
  sendJson,
  redirect,
  setCors,
  wantsJson,
};

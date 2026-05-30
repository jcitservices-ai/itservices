const SOURCE_LABEL = "jcit.digital/xurhomes (kickoff)";
const PROJECT_NAME = "Xur Homes Real Estate Website";
const CLIENT_COMPANY = "Xur Homes";
const KICKOFF_URL = "https://calendar.app.google/pd83py39DPTjBJU27";
const HERO_IMAGE = "https://jcit.digital/real-estate-demo/assets/apartment-exterior.jpg";
const INTERIOR_IMAGE = "https://jcit.digital/real-estate-demo/assets/luxury-living-room.jpg";
const DEFAULT_FROM = "JC IT Services <info@jcit.digital>";
const DEFAULT_REPLY_TO = "info@jcit.digital";
const DEFAULT_NOTIFY_EMAIL = "jake@jcit.digital";
const { verifyRecaptchaV2 } = require("../lib/recaptcha");

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function scrubLogMessage(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/re_[A-Za-z0-9_-]+/g, "[resend_key]")
    .slice(0, 1200);
}

function logKickoffIssue(label, error) {
  console.error(`[xurhomes-kickoff] ${label}`, {
    name: error?.name || "Error",
    message: scrubLogMessage(error?.message || error),
    statusCode: error?.statusCode || null,
    serviceStatus: error?.serviceStatus || null,
  });
}

function getErrorUrl(message) {
  const url = new URL("https://jcit.digital/xurhomes");
  url.searchParams.set("kickoff", "error");
  if (message) url.searchParams.set("message", String(message).slice(0, 180));
  url.hash = "approve-form";
  return url.toString();
}

function getEmailConfig() {
  return {
    apiKey: String(process.env.RESEND_API_KEY || "").trim(),
    from: String(process.env.JCIT_PROPOSAL_FROM_EMAIL || DEFAULT_FROM).trim(),
    replyTo: String(process.env.JCIT_PROPOSAL_REPLY_TO || DEFAULT_REPLY_TO).trim(),
    notifyEmail: String(process.env.JCIT_PROPOSAL_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL).trim(),
  };
}

function buildClientEmail({ clientName, contactNumber, email, notes }) {
  const safeName = toSafeLine(clientName) || "there";
  const safeContact = toSafeLine(contactNumber) || "Not provided";
  const safeEmail = normalizeEmail(email);
  const safeNotes = toSafeLine(notes) || "No additional notes provided.";
  const subject = `Proposal approved: ${PROJECT_NAME}`;

  const text = [
    `Hi ${safeName},`,
    ``,
    `Thank you for approving the ${PROJECT_NAME} proposal for ${CLIENT_COMPANY}.`,
    ``,
    `Project summary:`,
    `- Core website: About Us, Property Gallery, Blog, Contact Us & Lead Form`,
    `- Premium package: AI Chat Bot Assistant, Interactive Live Chat, Schedule Management System`,
    `- Kickoff booking: ${KICKOFF_URL}`,
    ``,
    `Next step: please book the kickoff meeting using the calendar link above so we can confirm content priorities, listing workflow, and launch schedule.`,
    ``,
    `Submission details:`,
    `- Client: ${safeName}`,
    `- Contact number: ${safeContact}`,
    `- Email: ${safeEmail}`,
    `- Notes: ${safeNotes}`,
    ``,
    `Best regards,`,
    `JC IT Services`,
  ].join("\n");

  const html = `
    <div style="margin:0;padding:32px 0;background:#06121d;background-image:radial-gradient(circle at 85% 15%, rgba(102,255,204,0.15), transparent 30%),radial-gradient(circle at 10% 85%, rgba(0,240,255,0.15), transparent 30%);font-family:Sora,Arial,sans-serif;color:#e8fbff;">
      <div style="max-width:680px;margin:0 auto;padding:0 20px;">
        <div style="overflow:hidden;border-radius:28px;border:1px solid rgba(183,241,255,0.14);box-shadow:0 24px 60px rgba(0,0,0,0.38);background:linear-gradient(180deg, rgba(11,26,41,0.96), rgba(7,18,29,0.98));">
          <img src="${HERO_IMAGE}" alt="Xur Homes property exterior" style="display:block;width:100%;height:240px;object-fit:cover;" />
          <div style="padding:28px;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#9ec2d5;">JC IT Services</p>
            <h1 style="margin:0 0 18px;font-size:30px;line-height:1.12;color:#f4fdff;">Proposal approved</h1>
            <p style="margin:0 0 14px;font-size:17px;line-height:1.7;color:#f4fdff;font-weight:700;">Hi ${escapeHtml(safeName)},</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#c9e7f2;">Thank you for approving the <strong>${escapeHtml(PROJECT_NAME)}</strong> proposal for <strong>${escapeHtml(CLIENT_COMPANY)}</strong>.</p>
            <div style="margin:0 0 18px;padding:18px;border-radius:20px;background:rgba(255,255,255,0.045);border:1px solid rgba(183,241,255,0.1);">
              <p style="margin:0 0 10px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#9ec2d5;">Project summary</p>
              <ul style="margin:0;padding-left:20px;color:#c9e7f2;font-size:15px;line-height:1.8;">
                <li>Core website: About Us, Property Gallery, Blog, Contact Us &amp; Lead Form</li>
                <li>Premium add-on: AI chatbot, live chat, and schedule management</li>
                <li>Kickoff booking: <a href="${KICKOFF_URL}" style="color:#66ffcc;">${KICKOFF_URL}</a></li>
              </ul>
            </div>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#c9e7f2;">Next step: please book the kickoff meeting so we can confirm content priorities, listing workflow, and launch schedule.</p>
            <p style="margin:0 0 22px;"><a href="${KICKOFF_URL}" style="display:inline-block;padding:13px 18px;border-radius:999px;background:linear-gradient(120deg,#00f0ff,#66ffcc);color:#03131e;text-decoration:none;font-weight:800;">Schedule kickoff meeting</a></p>
            <div style="margin:0 0 18px;padding:16px 18px;border-radius:18px;background:rgba(102,255,204,0.08);border:1px solid rgba(102,255,204,0.2);">
              <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#9ec2d5;">Submission details</p>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#e8fbff;">Client: ${escapeHtml(safeName)}<br />Contact number: ${escapeHtml(safeContact)}<br />Email: ${escapeHtml(safeEmail)}<br />Notes: ${escapeHtml(safeNotes)}</p>
            </div>
            <img src="${INTERIOR_IMAGE}" alt="Xur Homes property interior" style="display:block;width:100%;max-width:260px;height:160px;object-fit:cover;border-radius:18px;border:1px solid rgba(183,241,255,0.12);margin:0 0 18px;" />
            <p style="margin:0;font-size:15px;line-height:1.7;color:#f4fdff;">Best regards,<br /><strong>JC IT Services</strong></p>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

function buildInternalEmail({ clientName, contactNumber, email, approval, notes, source }) {
  const safeName = toSafeLine(clientName) || "Client";
  const subject = `New project approval - ${PROJECT_NAME} - ${safeName}`;

  const rows = [
    ["Project", PROJECT_NAME],
    ["Client Company", CLIENT_COMPANY],
    ["Client Name", clientName],
    ["Client Email", email],
    ["Contact Number", contactNumber],
    ["Approval", approval],
    ["Notes", notes],
    ["Kickoff Link", KICKOFF_URL],
    ["Source", source],
  ];

  const text = rows
    .map(([label, value]) => `${label}: ${toSafeLine(value) || "N/A"}`)
    .join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #dce8ee;color:#48606b;font-weight:700;">${escapeHtml(label)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #dce8ee;color:#102331;">${escapeHtml(value || "N/A")}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#102331;">
      <img src="${HERO_IMAGE}" alt="Xur Homes property exterior" style="display:block;width:100%;max-width:640px;height:220px;object-fit:cover;border-radius:18px;margin:0 0 18px;" />
      <h1 style="margin:0 0 12px;">New proposal approval</h1>
      <p style="margin:0 0 18px;">A client approved the Xur Homes website proposal and is ready to schedule kickoff.</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px;border:1px solid #dce8ee;">${htmlRows}</table>
    </div>
  `.trim();

  return { subject, text, html };
}

async function sendResendEmail({ to, subject, text, html }) {
  const { apiKey, from, replyTo } = getEmailConfig();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

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
    const error = new Error(
      payload?.message || payload?.error || `Resend failed with ${response.status}.`
    );
    error.statusCode = 502;
    error.serviceStatus = response.status;
    throw error;
  }

  return payload;
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

    await verifyRecaptchaV2({
      token: fields["g-recaptcha-response"] || fields.recaptcha_token,
      ip: getClientIp(req),
      secretKey: process.env.RECAPTCHA_SECRET_KEY,
    });

    const nextUrl = String(fields._next || "https://jcit.digital/thank-you/").trim();
    const clientName = toSafeLine(fields.client_name);
    const contactNumber = toSafeLine(fields.contact_number);
    const email = normalizeEmail(fields.email);
    const approval = toSafeLine(fields.project_approval);
    const notes = toSafeLine(fields.notes);
    const source = SOURCE_LABEL;

    if (!clientName) {
      const error = new Error("Client name is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!contactNumber) {
      const error = new Error("Contact number is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!isEmail(email)) {
      const error = new Error("A valid email address is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!approval) {
      const error = new Error("Project approval is required.");
      error.statusCode = 400;
      throw error;
    }

    const clientEmail = buildClientEmail({ clientName, contactNumber, email, notes });
    const internalEmail = buildInternalEmail({
      clientName,
      contactNumber,
      email,
      approval,
      notes,
      source,
    });

    await sendResendEmail({ to: email, ...clientEmail });

    const { notifyEmail } = getEmailConfig();
    if (notifyEmail) {
      await sendResendEmail({ to: notifyEmail, ...internalEmail });
    }

    if (wantsJson(req)) return sendJson(res, 200, { ok: true, redirect: nextUrl });
    return redirect(res, nextUrl);
  } catch (error) {
    logKickoffIssue("Kickoff submission failed", error);
    const statusCode = error.statusCode || 500;
    const message =
      statusCode >= 500
        ? "Request could not be submitted right now. Please try again later."
        : error.message;
    if (wantsJson(req)) return sendJson(res, statusCode, { ok: false, message });
    return redirect(res, getErrorUrl(message));
  }
};

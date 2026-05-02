const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const CALENDAR_URL = "https://calendar.app.google/7G1fBBC59ULfXQAr5";
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xreabold";
const DEFAULT_POSITION = "Web Designer and Developer";
const DEFAULT_NOTIFY_EMAIL = "jake@jcit.digital";
const DEFAULT_REPLY_TO = "jake@jcit.digital";

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

function getOrigin(req) {
  return String(req.headers.origin || "").trim();
}

function setCors(req, res) {
  const origin = getOrigin(req);
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

function sanitizeFilename(value) {
  const cleaned = String(value || "resume")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "resume";
}

function getEmailConfig() {
  const rawFrom = String(
    process.env.JCIT_RECRUITMENT_FROM_EMAIL ||
      process.env.SESSION_SUMMARY_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      "JC IT Services <jake@jcit.digital>"
  ).trim();

  return {
    apiKey: String(process.env.RESEND_API_KEY || "").trim(),
    from: rawFrom,
    replyTo: String(
      process.env.JCIT_RECRUITMENT_REPLY_TO ||
        process.env.SESSION_SUMMARY_REPLY_TO ||
        DEFAULT_REPLY_TO
    ).trim(),
    notifyEmail: String(process.env.JCIT_RECRUITMENT_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL).trim(),
  };
}

function getFormspreeEndpoint() {
  return String(process.env.JCIT_FORMSPREE_ENDPOINT || FORMSPREE_ENDPOINT).trim();
}

async function readRawBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_UPLOAD_BYTES) {
      const error = new Error("Application upload is too large. Please keep your resume/CV under 8 MB.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function getBoundary(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match ? (match[1] || match[2] || "").trim() : "";
}

function parseDisposition(header) {
  const result = {};
  const parts = String(header || "").split(";").map((part) => part.trim());

  for (const part of parts) {
    const [key, rawValue] = part.split("=");
    if (!rawValue) continue;
    result[key.toLowerCase()] = rawValue.replace(/^"|"$/g, "");
  }

  return result;
}

function parseMultipart(buffer, contentType) {
  const boundary = getBoundary(contentType);
  if (!boundary) {
    const error = new Error("Missing multipart boundary.");
    error.statusCode = 400;
    throw error;
  }

  const fields = {};
  const files = {};
  const body = buffer.toString("latin1");
  const rawParts = body.split(`--${boundary}`).slice(1, -1);

  for (let part of rawParts) {
    part = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = part.indexOf("\r\n\r\n");
    if (separatorIndex === -1) continue;

    const rawHeaders = part.slice(0, separatorIndex);
    const rawValue = part.slice(separatorIndex + 4);
    const headers = {};

    rawHeaders.split("\r\n").forEach((line) => {
      const index = line.indexOf(":");
      if (index === -1) return;
      headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    });

    const disposition = parseDisposition(headers["content-disposition"]);
    const name = disposition.name;
    if (!name) continue;

    if (disposition.filename) {
      const content = Buffer.from(rawValue, "latin1");
      if (content.length > 0) {
        files[name] = {
          filename: sanitizeFilename(disposition.filename),
          contentType: headers["content-type"] || "application/octet-stream",
          content,
        };
      }
    } else {
      fields[name] = Buffer.from(rawValue, "latin1").toString("utf8").trim();
    }
  }

  return { fields, files };
}

function assertAllowedResume(file) {
  if (!file || !file.content?.length) {
    const error = new Error("Please upload your resume/CV.");
    error.statusCode = 400;
    throw error;
  }

  const ext = file.filename.toLowerCase().split(".").pop();
  const allowedExts = new Set(["pdf", "doc", "docx"]);
  if (!allowedExts.has(ext)) {
    const error = new Error("Resume/CV must be a PDF, DOC, or DOCX file.");
    error.statusCode = 400;
    throw error;
  }
}

function buildApplicantEmail({ name, position }) {
  const safeName = toSafeLine(name) || "there";
  const safePosition = toSafeLine(position) || DEFAULT_POSITION;
  const subject = `Next step for your JC IT Services application`;

  const text = [
    `Hi ${safeName}!`,
    ``,
    `Thank you for applying for the ${safePosition} role at JC IT Services. We have received your application and would like to move forward with the next step.`,
    ``,
    `Please schedule your interview using the link below:`,
    CALENDAR_URL,
    ``,
    `Requirement:`,
    `Kindly send your most updated CV or resume by replying to this email before your scheduled interview.`,
    ``,
    `What to Expect:`,
    `- Quick introduction`,
    `- Discussion about your experience and approach to the role`,
    `- Overview of the role and expectations`,
    `- Opportunity for you to ask questions`,
    ``,
    `Please make sure to book a time that works best for you. Once scheduled, you will receive a confirmation with the meeting details.`,
    ``,
    `We look forward to speaking with you.`,
    ``,
    `Best regards,`,
    `JC IT SERVICES`,
  ].join("\n");

  const html = `
    <div style="margin:0;padding:32px 0;background:#06121d;background-image:radial-gradient(circle at 85% 15%, rgba(102,255,204,0.15), transparent 30%),radial-gradient(circle at 10% 85%, rgba(0,240,255,0.15), transparent 30%);font-family:Sora,Arial,sans-serif;color:#e8fbff;">
      <div style="max-width:680px;margin:0 auto;padding:0 20px;">
        <div style="padding:28px;border-radius:28px;background:linear-gradient(180deg, rgba(11,26,41,0.96), rgba(7,18,29,0.98));border:1px solid rgba(183,241,255,0.14);box-shadow:0 24px 60px rgba(0,0,0,0.38);">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#9ec2d5;">JC IT Services</p>
          <h1 style="margin:0 0 18px;font-size:30px;line-height:1.12;color:#f4fdff;">Application next step</h1>
          <p style="margin:0 0 14px;font-size:17px;line-height:1.7;color:#f4fdff;font-weight:700;">Hi ${escapeHtml(safeName)}!</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#c9e7f2;">Thank you for applying for the <strong>${escapeHtml(safePosition)}</strong> role at JC IT Services. We have received your application and would like to move forward with the next step.</p>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#c9e7f2;">Please schedule your interview using the link below:</p>
          <p style="margin:0 0 22px;"><a href="${CALENDAR_URL}" style="display:inline-block;padding:13px 18px;border-radius:999px;background:linear-gradient(120deg,#00f0ff,#66ffcc);color:#03131e;text-decoration:none;font-weight:800;">Schedule your interview</a></p>
          <div style="margin:0 0 18px;padding:16px 18px;border-radius:18px;background:rgba(102,255,204,0.08);border:1px solid rgba(102,255,204,0.2);">
            <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#9ec2d5;">Requirement</p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#e8fbff;">Kindly send your most updated CV or resume by replying to this email before your scheduled interview.</p>
          </div>
          <div style="margin:0 0 20px;padding:18px;border-radius:20px;background:rgba(255,255,255,0.045);border:1px solid rgba(183,241,255,0.1);">
            <p style="margin:0 0 10px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#9ec2d5;">What to Expect</p>
            <ul style="margin:0;padding-left:20px;color:#c9e7f2;font-size:15px;line-height:1.8;">
              <li>Quick introduction</li>
              <li>Discussion about your experience and approach to the role</li>
              <li>Overview of the role and expectations</li>
              <li>Opportunity for you to ask questions</li>
            </ul>
          </div>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#c9e7f2;">Please make sure to book a time that works best for you. Once scheduled, you will receive a confirmation with the meeting details.</p>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#c9e7f2;">We look forward to speaking with you.</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#f4fdff;">Best regards,<br /><strong>JC IT SERVICES</strong></p>
        </div>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

function buildInternalEmail({ fields, resumeFile }) {
  const name = toSafeLine(fields.name);
  const position = toSafeLine(fields.position) || DEFAULT_POSITION;
  const subject = `New ${position} application - ${name || "Applicant"}`;

  const rows = [
    ["Name", fields.name],
    ["Email", fields.email],
    ["Contact Number", fields.contact_number],
    ["Location / Time Zone", fields.location],
    ["Position", position],
    ["Portfolio", fields.portfolio_link],
    ["WordPress Experience", fields.wordpress_experience],
    ["cPanel Experience", fields.cpanel_experience],
    ["Message", fields.message],
    ["Resume/CV", resumeFile?.filename],
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
      <h1 style="margin:0 0 12px;">New JC IT Services application</h1>
      <p style="margin:0 0 18px;">A new applicant submitted the Web Designer and Developer form.</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px;border:1px solid #dce8ee;">${htmlRows}</table>
    </div>
  `.trim();

  return { subject, text, html };
}

async function sendResendEmail({ to, subject, text, html, attachments = [] }) {
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
      ...(attachments.length ? { attachments } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Resend failed with ${response.status}.`);
  }

  return payload;
}

async function forwardToFormspree({ fields, resumeFile }) {
  const endpoint = getFormspreeEndpoint();
  if (!endpoint) return;

  const form = new FormData();
  const forwardedFields = {
    _subject: `JC IT Services - ${toSafeLine(fields.position) || DEFAULT_POSITION} Application`,
    _replyto: normalizeEmail(fields.email),
    source: "jcit.digital/webdev",
    name: fields.name,
    email: normalizeEmail(fields.email),
    contact_number: fields.contact_number,
    location: fields.location,
    position: fields.position || DEFAULT_POSITION,
    portfolio_link: fields.portfolio_link,
    wordpress_experience: fields.wordpress_experience,
    cpanel_experience: fields.cpanel_experience,
    role_acknowledgement: fields.role_acknowledgement,
    message: fields.message,
  };

  Object.entries(forwardedFields).forEach(([key, value]) => {
    form.append(key, String(value || ""));
  });

  if (resumeFile?.content?.length) {
    form.append(
      "resume_file",
      new Blob([resumeFile.content], { type: resumeFile.contentType || "application/octet-stream" }),
      resumeFile.filename
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload?.error || payload?.message || `Formspree forwarding failed with ${response.status}.`
    );
  }
}

async function handleApplication(req, res) {
  const contentType = req.headers["content-type"] || "";
  if (!String(contentType).toLowerCase().includes("multipart/form-data")) {
    const error = new Error("Application form must use multipart/form-data.");
    error.statusCode = 415;
    throw error;
  }

  const body = await readRawBody(req);
  const { fields, files } = parseMultipart(body, contentType);

  if (fields.company) {
    redirect(res, "https://jcit.digital/join-confirmation/");
    return;
  }

  const name = toSafeLine(fields.name);
  const email = normalizeEmail(fields.email);
  const position = toSafeLine(fields.position) || DEFAULT_POSITION;
  const resumeFile = files.resume_file;

  if (!name) {
    const error = new Error("Name is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!isEmail(email)) {
    const error = new Error("A valid email address is required.");
    error.statusCode = 400;
    throw error;
  }
  assertAllowedResume(resumeFile);

  const { notifyEmail } = getEmailConfig();
  const attachment = {
    filename: resumeFile.filename,
    content: resumeFile.content.toString("base64"),
  };

  const applicantEmail = buildApplicantEmail({ name, position });
  const internalEmail = buildInternalEmail({ fields: { ...fields, email, position }, resumeFile });

  await sendResendEmail({
    to: email,
    ...applicantEmail,
  });

  if (notifyEmail) {
    await sendResendEmail({
      to: notifyEmail,
      ...internalEmail,
      attachments: [attachment],
    });
  }

  await forwardToFormspree({ fields: { ...fields, email, position }, resumeFile });

  redirect(res, "https://jcit.digital/join-confirmation/");
}

async function handler(req, res) {
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
    await handleApplication(req, res);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode >= 500
        ? "Application could not be submitted right now. Please try again later."
        : error.message;
    sendJson(res, statusCode, { ok: false, message });
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

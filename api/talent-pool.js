const { appendTalentSignup } = require("../lib/talent-pool-store");

const MAX_BODY_BYTES = 32_000;
const ALLOWED_POSITIONS = new Set([
  "Web Designer and Developer",
  "Sales Development Representative",
  "Virtual Assistant",
  "Social Media Manager",
  "AV Technician",
  "Surveillance Operator",
  "CAD Designer",
  "AI Engineer",
  "PBX Engineer",
  "Help Desk",
  "Other / Future Opportunity",
]);

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  const allowed =
    origin === "https://jcit.digital" ||
    origin === "https://www.jcit.digital" ||
    /^https:\/\/[-a-z0-9]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("Request is too large.");
      error.statusCode = 413;
      throw error;
    }
  }
  return JSON.parse(body || "{}");
}

function clean(value, maxLength) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function validate(body) {
  const fields = {
    name: clean(body.name, 120),
    email: clean(body.email, 180).toLowerCase(),
    phone: clean(body.phone, 40),
    position: clean(body.position, 100),
    consent: body.consent === true || body.consent === "true" || body.consent === "on",
    company: clean(body.company, 120),
    source: clean(body.source, 120) || "jcit.digital/talents",
  };

  if (fields.company) return { ...fields, spam: true };
  if (fields.name.length < 2) throw Object.assign(new Error("Please enter your full name."), { statusCode: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw Object.assign(new Error("Please enter a valid email address."), { statusCode: 400 });
  }
  if (!/^[+()\-\s.0-9]{7,40}$/.test(fields.phone)) {
    throw Object.assign(new Error("Please enter a valid phone number."), { statusCode: 400 });
  }
  if (!ALLOWED_POSITIONS.has(fields.position)) {
    throw Object.assign(new Error("Please select a position from the list."), { statusCode: 400 });
  }
  if (!fields.consent) {
    throw Object.assign(new Error("Privacy consent is required to join the talent pool."), { statusCode: 400 });
  }
  return fields;
}

function emailHtml(name) {
  const safeName = String(name).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  return `
    <div style="margin:0;background:#06121d;padding:32px 16px;font-family:Arial,sans-serif;color:#eaf7f3">
      <div style="max-width:620px;margin:auto;border:1px solid #173444;border-radius:18px;background:#0b1b27;padding:32px">
        <p style="margin:0 0 12px;color:#66ffcc;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">JCIT Talent Pool</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#fff">Welcome to the JCIT talent community.</h1>
        <p style="color:#c4d6d2;line-height:1.7">Hi ${safeName},</p>
        <p style="color:#c4d6d2;line-height:1.7">Thanks for meeting us and sharing your interest. We saved your details in the JCIT Talent Pool.</p>
        <p style="color:#c4d6d2;line-height:1.7">The next step is to complete the full application on our careers site so our team has the information needed to match you with future opportunities.</p>
        <p style="margin:26px 0"><a href="https://jcit.digital/join/" style="display:inline-block;border-radius:999px;background:#66ffcc;color:#06121d;padding:14px 22px;text-decoration:none;font-weight:700">Complete your application</a></p>
        <p style="margin:22px 0 0;color:#8fa8a3;font-size:13px;line-height:1.6">Joining the talent pool does not guarantee employment. JCIT HR may contact you when a suitable opening becomes available.</p>
      </div>
    </div>`;
}

async function sendConfirmation({ name, email }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw Object.assign(new Error("Confirmation email is not configured."), { statusCode: 503 });
  const from = String(process.env.JCIT_TALENT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "JC IT Services <noreply@jcit.digital>").trim();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      reply_to: String(process.env.JCIT_TALENT_REPLY_TO || "jake@jcit.digital").trim(),
      subject: "Welcome to the JCIT Talent Pool",
      html: emailHtml(name),
      text: `Hi ${name},\n\nThanks for joining the JCIT Talent Pool. Complete your application at https://jcit.digital/join/ so our team can match you with future opportunities.\n\nJoining the talent pool does not guarantee employment. JCIT HR may contact you when a suitable opening becomes available.`,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || "Confirmation email could not be sent."), { statusCode: 502 });
  return data;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { ok: false, message: "Method not allowed." });

  try {
    const fields = validate(await readJson(req));
    if (fields.spam) return send(res, 200, { ok: true });
    const submittedAt = new Date().toISOString();

    await appendTalentSignup({ ...fields, submittedAt });

    let emailSent = true;
    try {
      await sendConfirmation(fields);
    } catch (error) {
      emailSent = false;
      console.error("[talent-pool] signup saved but email failed", error.message);
    }

    return send(res, 200, {
      ok: true,
      emailSent,
      message: emailSent
        ? "You’re in! Check your email for the next step."
        : "You’re in! Your details were saved. Our team will follow up with next steps.",
    });
  } catch (error) {
    console.error("[talent-pool] submission failed", error.message);
    return send(res, error.statusCode || 500, {
      ok: false,
      message: error.statusCode && error.statusCode < 500
        ? error.message
        : "We couldn’t save your details right now. Please try again in a moment.",
    });
  }
};

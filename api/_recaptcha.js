function scrub(value) {
  return String(value || "").slice(0, 1200);
}

async function verifyRecaptchaV2({ token, ip, secretKey }) {
  const payloadToken = String(token || "").trim();
  const payloadSecret = String(secretKey || "").trim();

  // Soft enforcement until keys are configured in prod.
  if (!payloadSecret) return { skipped: true };

  if (!payloadToken) {
    const error = new Error("Captcha is required.");
    error.statusCode = 400;
    throw error;
  }

  const form = new URLSearchParams();
  form.set("secret", payloadSecret);
  form.set("response", payloadToken);
  if (ip) form.set("remoteip", String(ip));

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Captcha verification failed with ${response.status}.`);
    error.statusCode = 502;
    error.serviceStatus = response.status;
    error.details = scrub(JSON.stringify(data));
    throw error;
  }

  if (!data || data.success !== true) {
    const error = new Error("Captcha verification failed. Please try again.");
    error.statusCode = 400;
    error.details = scrub(JSON.stringify(data));
    throw error;
  }

  return data;
}

module.exports = { verifyRecaptchaV2 };


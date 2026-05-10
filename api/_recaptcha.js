function scrub(value) {
  return String(value || "").slice(0, 1200);
}

async function verifyRecaptchaV2({ token, ip, secretKey }) {
  // Captcha intentionally disabled for now.
  void token;
  void ip;
  void secretKey;
  return { skipped: true };

  // unreachable
}

module.exports = { verifyRecaptchaV2 };

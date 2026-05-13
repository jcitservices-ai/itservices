async function verifyRecaptchaV2() {
  // Captcha intentionally disabled for now.
  return { skipped: true };
}

module.exports = { verifyRecaptchaV2 };


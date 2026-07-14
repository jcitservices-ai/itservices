const { handleForm } = require("../lib/form-automation");

module.exports = function handler(req, res) {
  return handleForm(req, res, {
    kind: "career",
    title: "JCIT Services - SDR application",
    source: "jcit.digital/sdr",
    successUrl: "https://jcit.digital/join-confirmation/",
    errorUrl: "https://jcit.digital/sdr/",
    required: ["name", "email", "contact_number", "location", "sales_experience", "message"],
    nextStep: "Our recruitment team will review your sales background, work-readiness assessment, and application details.",
  });
};

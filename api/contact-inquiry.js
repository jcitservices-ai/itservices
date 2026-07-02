const { handleForm } = require("../lib/form-automation");

module.exports = function handler(req, res) {
  return handleForm(req, res, {
    kind: "lead",
    title: "JCIT 2.0 project inquiry",
    source: "jcit.digital/contact project-intake",
    successUrl: "https://jcit.digital/thank-you/",
    errorUrl: "https://jcit.digital/contact/",
    required: ["name", "email", "service", "message"],
    nextStep: "A JCIT operator will review your brief and respond with the right next step, usually within one business day.",
  });
};

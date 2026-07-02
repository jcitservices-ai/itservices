const { handleForm } = require("../lib/form-automation");

module.exports = function handler(req, res) {
  return handleForm(req, res, {
    kind: "career",
    title: "JCIT 2.0 general career application",
    source: "jcit.digital/careers general-application",
    successUrl: "https://jcit.digital/join-confirmation/",
    errorUrl: "https://jcit.digital/join/",
    required: ["name", "email", "position", "location", "resume_link", "message"],
    nextStep: "If the role fit is clear, we will route you to the right interview or dedicated role form.",
  });
};

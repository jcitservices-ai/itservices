const { handleForm } = require("../lib/form-automation");

module.exports = function handler(req, res) {
  return handleForm(req, res, {
    kind: "lead",
    title: "JCIT 2.0 call request",
    source: "jcit.digital/contact booking",
    successUrl: "https://jcit.digital/booking-confirmation/",
    errorUrl: "https://jcit.digital/contact/",
    required: ["name", "email", "timezone", "preferred_date", "preferred_time", "call_type"],
    nextStep: "We will confirm the schedule and send a meeting link with a focused agenda.",
  });
};

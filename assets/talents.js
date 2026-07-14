(() => {
  const form = document.querySelector("[data-talent-form]");
  if (!form) return;

  const submitButton = form.querySelector("button[type='submit']");
  const buttonLabel = form.querySelector("[data-button-label]");
  const status = form.querySelector("[data-form-status]");
  const successPanel = document.querySelector("[data-success-panel]");
  const successMessage = document.querySelector("[data-success-message]");
  const endpoint = window.JCIT_TALENT_API_URL || "https://jcit-talents-api.vercel.app/api/talent-pool";

  function setError(name, message) {
    const field = form.elements[name];
    const error = form.querySelector(`[data-error-for="${name}"]`);
    if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) error.textContent = message || "";
  }

  function validate() {
    const data = new FormData(form);
    const values = Object.fromEntries(data.entries());
    const errors = {
      name: values.name?.trim().length >= 2 ? "" : "Enter your full name.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email || "") ? "" : "Enter a valid email address.",
      phone: /^[+()\-\s.0-9]{7,40}$/.test(values.phone || "") ? "" : "Enter a valid phone number.",
      position: values.position ? "" : "Select an area of interest.",
      consent: data.has("consent") ? "" : "Please provide consent to join the talent pool.",
    };
    Object.entries(errors).forEach(([name, message]) => setError(name, message));
    const firstError = Object.entries(errors).find(([, message]) => message);
    if (firstError) form.elements[firstError[0]]?.focus();
    return !firstError;
  }

  form.addEventListener("input", (event) => {
    if (event.target.name) setError(event.target.name, "");
    status.textContent = "";
  });
  form.addEventListener("change", (event) => {
    if (event.target.name) setError(event.target.name, "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    if (!validate()) return;

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.consent = formData.has("consent");
    submitButton.disabled = true;
    buttonLabel.textContent = "Adding you…";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || "Submission failed.");

      form.hidden = true;
      document.querySelector(".form-heading").hidden = true;
      successMessage.textContent = result.message || "Check your email for the link to complete your full application.";
      successPanel.hidden = false;
      successPanel.focus();
      form.reset();
    } catch (error) {
      status.textContent = error.message || "We couldn’t save your details. Please try again.";
      submitButton.disabled = false;
      buttonLabel.textContent = "Join the talent pool";
    }
  });
})();

(function () {
  "use strict";

  const STORAGE_KEY = "jcitApplicantAssessmentV1";
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const formSelector = [
    "[data-application-form]",
    "[data-webdev-form]",
    "[data-join-form]",
    ".proposal-application-form",
  ].join(",");

  function readResult() {
    try {
      const result = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const completedAt = Date.parse(result?.completedAt || "");
      if (!result || !Number.isFinite(completedAt) || Date.now() - completedAt > MAX_AGE_MS) return null;
      if (!result.typing?.completed || !result.speed?.completed) return null;
      return result;
    } catch (_error) {
      return null;
    }
  }

  function assessmentUrl() {
    const returnTo = `${window.location.pathname}${window.location.search}#application`;
    return `/applicant-check/?return=${encodeURIComponent(returnTo)}`;
  }

  function ensureField(form, name, value) {
    let field = form.querySelector(`input[name="${name}"]`);
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = name;
      form.appendChild(field);
    }
    field.value = String(value ?? "");
  }

  function attachResult(form, result) {
    ensureField(form, "typing_wpm", result.typing.wpm);
    ensureField(form, "typing_accuracy", result.typing.accuracy);
    ensureField(form, "typing_test_seconds", result.typing.seconds);
    ensureField(form, "internet_download_mbps", result.speed.downloadMbps);
    ensureField(form, "internet_latency_ms", result.speed.latencyMs);
    ensureField(form, "internet_connection_type", result.speed.connectionType || "Not reported");
    ensureField(form, "assessment_completed_at", result.completedAt);

    const message = form.querySelector('textarea[name="message"]');
    if (message) {
      const marker = "[JCIT APPLICANT ASSESSMENT]";
      const clean = message.value.split(marker)[0].trimEnd();
      const summary = [
        marker,
        `Typing: ${result.typing.wpm} WPM at ${result.typing.accuracy}% accuracy (${result.typing.seconds}s)`,
        `Internet: ${result.speed.downloadMbps} Mbps download, ${result.speed.latencyMs} ms latency`,
        `Connection: ${result.speed.connectionType || "Not reported"}`,
        `Completed: ${result.completedAt}`,
      ].join("\n");
      message.value = `${clean}\n\n${summary}`.trim();
    }
  }

  function buildPrompt(form, result) {
    const submit = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!submit) return;

    const panel = document.createElement("div");
    panel.className = `application-assessment-prompt${result ? " is-complete" : ""}`;

    const heading = document.createElement("strong");
    heading.textContent = result ? "Applicant checks completed" : "Required applicant checks";

    const copy = document.createElement("span");
    copy.textContent = result
      ? `${result.typing.wpm} WPM · ${result.typing.accuracy}% accuracy · ${result.speed.downloadMbps} Mbps download · ${result.speed.latencyMs} ms latency`
      : "Complete the JCIT typing and internet checks before submitting this application.";

    const link = document.createElement("a");
    link.className = "button secondary";
    link.href = assessmentUrl();
    link.textContent = result ? "Retake Tests" : "Start Required Tests";

    panel.append(heading, copy, link);
    submit.parentNode.insertBefore(panel, submit);
  }

  document.querySelectorAll(formSelector).forEach((form) => {
    const result = readResult();
    if (result) attachResult(form, result);
    buildPrompt(form, result);

    form.addEventListener(
      "submit",
      (event) => {
        const current = readResult();
        if (!current) {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.location.assign(assessmentUrl());
          return;
        }
        attachResult(form, current);
      },
      true
    );
  });
})();

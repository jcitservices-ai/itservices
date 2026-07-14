(function () {
  "use strict";

  const STORAGE_KEY = "jcitApplicantAssessmentV1";
  const PASSAGE = "Clear communication keeps technical work moving. At JCIT Services, people use modern tools to organize information, solve problems, support clients, and follow through on every commitment with care and accountability. Strong team members ask useful questions, document important details, raise blockers early, and make thoughtful decisions instead of relying on automation alone. Reliable work combines speed with accuracy, sound judgment, respect for the client, and consistent ownership from the first handoff through final delivery.";
  const state = { typing: null, speed: null, disc: null, english: null, timer: null, startedAt: 0 };
  const DISC_LABELS = {
    D: "Dominance — direct and results-focused",
    I: "Influence — expressive and people-focused",
    S: "Steadiness — patient and supportive",
    C: "Conscientiousness — careful and quality-focused",
  };
  const ENGLISH_ANSWERS = ["b", "c", "a", "d", "b", "c", "a", "d", "b", "c"];

  const passage = document.querySelector("[data-typing-passage]");
  const input = document.querySelector("[data-typing-input]");
  const startButton = document.querySelector("[data-start-typing]");
  const finishButton = document.querySelector("[data-finish-typing]");
  const timerText = document.querySelector("[data-typing-time]");
  const typingStatus = document.querySelector("[data-typing-status]");
  const speedButton = document.querySelector("[data-run-speed]");
  const speedStatus = document.querySelector("[data-speed-status]");
  const discForm = document.querySelector("[data-disc-form]");
  const discStatus = document.querySelector("[data-disc-status]");
  const englishForm = document.querySelector("[data-english-form]");
  const englishStatus = document.querySelector("[data-english-status]");
  const completePanel = document.querySelector("[data-assessment-complete]");
  const returnLink = document.querySelector("[data-return-link]");

  passage.textContent = PASSAGE;

  function metric(name, value) {
    const node = document.querySelector(`[data-metric="${name}"]`);
    if (node) node.textContent = value;
  }

  function safeReturnUrl() {
    const value = new URLSearchParams(window.location.search).get("return") || "/join/#apply";
    return value.startsWith("/") && !value.startsWith("//") ? value : "/join/#apply";
  }

  returnLink.href = safeReturnUrl();

  function updateCompletion() {
    document.querySelector('[data-step="typing"]').classList.toggle("is-complete", Boolean(state.typing));
    document.querySelector('[data-step="speed"]').classList.toggle("is-complete", Boolean(state.speed));
    document.querySelector('[data-step="disc"]').classList.toggle("is-complete", Boolean(state.disc));
    document.querySelector('[data-step="english"]').classList.toggle("is-complete", Boolean(state.english));
    if (!state.typing || !state.speed || !state.disc || !state.english) return;

    const result = {
      version: 1,
      completedAt: new Date().toISOString(),
      typing: state.typing,
      speed: state.speed,
      disc: state.disc,
      english: state.english,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    completePanel.hidden = false;
    returnLink.focus();
  }

  function finishTyping() {
    if (!state.startedAt) return;
    clearInterval(state.timer);
    state.timer = null;
    const seconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
    const typed = input.value;
    let correct = 0;
    for (let index = 0; index < typed.length; index += 1) {
      if (typed[index] === PASSAGE[index]) correct += 1;
    }
    const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 0;
    const wpm = Math.max(0, Math.round(correct / 5 / (seconds / 60)));

    state.typing = { completed: true, wpm, accuracy, seconds };
    input.disabled = true;
    finishButton.disabled = true;
    startButton.disabled = false;
    startButton.textContent = "Retake Typing Test";
    typingStatus.textContent = `Completed: ${wpm} WPM at ${accuracy}% accuracy.`;
    metric("wpm", `${wpm} WPM`);
    metric("accuracy", `${accuracy}%`);
    updateCompletion();
  }

  function startTyping() {
    state.typing = null;
    state.startedAt = Date.now();
    input.value = "";
    input.disabled = false;
    finishButton.disabled = true;
    startButton.disabled = true;
    timerText.textContent = "60 seconds";
    typingStatus.textContent = "Type the passage exactly. Finish becomes available after 30 seconds.";
    input.focus();

    state.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      timerText.textContent = `${remaining} seconds`;
      if (elapsed >= 30) finishButton.disabled = false;
      if (remaining === 0 || (elapsed >= 30 && input.value.length >= PASSAGE.length)) finishTyping();
    }, 250);
  }

  startButton.addEventListener("click", startTyping);
  finishButton.addEventListener("click", finishTyping);
  input.addEventListener("paste", (event) => {
    event.preventDefault();
    typingStatus.textContent = "Pasting is disabled for this typing check.";
    typingStatus.classList.add("is-error");
  });

  async function timedFetch(url) {
    const started = performance.now();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("The test file could not be downloaded.");
    const buffer = await response.arrayBuffer();
    return { ms: performance.now() - started, bytes: buffer.byteLength };
  }

  async function runSpeedTest() {
    speedButton.disabled = true;
    speedStatus.classList.remove("is-error");
    speedStatus.textContent = "Checking latency and downloading a lightweight test payload…";
    state.speed = null;

    try {
      const latencyRuns = [];
      for (let index = 0; index < 3; index += 1) {
        const run = await timedFetch(`/assets/favicon-16x16.png?latency=${Date.now()}-${index}`);
        latencyRuns.push(run.ms);
      }
      const latencyMs = Math.round(latencyRuns.reduce((sum, value) => sum + value, 0) / latencyRuns.length);
      const download = await timedFetch(`/assets/images/jcit-ai-enabled-delivery.png?speed=${Date.now()}`);
      const downloadMbps = Math.max(0.1, (download.bytes * 8) / (download.ms / 1000) / 1000000).toFixed(1);
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const connectionType = connection?.effectiveType || "Not reported by browser";

      state.speed = { completed: true, downloadMbps, latencyMs, connectionType };
      metric("download", `${downloadMbps} Mbps`);
      metric("latency", `${latencyMs} ms`);
      metric("connection", connectionType);
      speedStatus.textContent = "Connection check completed. Results are approximate and may vary by Wi-Fi, device, and network traffic.";
      speedButton.textContent = "Run Again";
      updateCompletion();
    } catch (error) {
      speedStatus.textContent = `${error.message || "Connection check failed."} Please check your connection and try again.`;
      speedStatus.classList.add("is-error");
    } finally {
      speedButton.disabled = false;
    }
  }

  speedButton.addEventListener("click", runSpeedTest);

  discForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(discForm);
    const answers = Array.from({ length: 8 }, (_, index) => data.get(`disc_${index + 1}`));
    if (answers.some((answer) => !answer)) {
      discStatus.textContent = "Please answer all 8 work-style questions.";
      discStatus.classList.add("is-error");
      return;
    }

    const scores = { D: 0, I: 0, S: 0, C: 0 };
    answers.forEach((answer) => { scores[answer] += 1; });
    const highest = Math.max(...Object.values(scores));
    const primaryCodes = Object.keys(scores).filter((code) => scores[code] === highest);
    const primary = primaryCodes.join("/");

    state.disc = { completed: true, primary, scores };
    metric("disc", primary);
    discStatus.classList.remove("is-error");
    discStatus.textContent = `Completed: ${primaryCodes.map((code) => DISC_LABELS[code]).join("; ")}.`;
    discForm.querySelector('button[type="submit"]').textContent = "Update Work-Style Result";
    updateCompletion();
  });

  englishForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(englishForm);
    const answers = ENGLISH_ANSWERS.map((_, index) => data.get(`english_${index + 1}`));
    if (answers.some((answer) => !answer)) {
      englishStatus.textContent = "Please answer all 10 English questions.";
      englishStatus.classList.add("is-error");
      return;
    }

    const correct = answers.reduce((total, answer, index) => total + Number(answer === ENGLISH_ANSWERS[index]), 0);
    const percent = correct * 10;
    const level = percent >= 90 ? "Advanced" : percent >= 70 ? "Upper-intermediate" : percent >= 50 ? "Intermediate" : "Developing";
    state.english = { completed: true, correct, total: 10, percent, level };
    metric("english", `${percent}%`);
    englishStatus.classList.remove("is-error");
    englishStatus.textContent = `Completed: ${correct}/10 correct — ${level}.`;
    englishForm.querySelector('button[type="submit"]').textContent = "Update English Result";
    updateCompletion();
  });
})();

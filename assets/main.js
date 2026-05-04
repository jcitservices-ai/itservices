const attachLoader = () => {
  const loader = document.createElement("div");
  loader.className = "site-loader";
  loader.setAttribute("aria-hidden", "true");
  loader.innerHTML = `
    <div class="site-loader-panel">
      <img class="site-loader-logo" src="/assets/logo.webp" alt="" />
      <div class="site-loader-ring"></div>
      <span class="site-loader-text">Booting AI Systems</span>
    </div>
  `;
  document.body.classList.add("loader-active");
  document.body.appendChild(loader);
  return loader;
};

const pageLoader = attachLoader();

const progressBar = document.createElement("div");
progressBar.className = "site-progress";
progressBar.setAttribute("aria-hidden", "true");
document.body.appendChild(progressBar);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const setupCustomCursor = () => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!finePointer.matches || prefersReducedMotion.matches) return;

  const cursor = document.createElement("div");
  const dot = document.createElement("div");
  cursor.className = "jc-cursor is-hidden";
  dot.className = "jc-cursor-dot is-hidden";
  cursor.setAttribute("aria-hidden", "true");
  dot.setAttribute("aria-hidden", "true");
  document.body.append(cursor, dot);
  document.body.classList.add("has-custom-cursor");

  const interactiveSelector = [
    "a",
    "button",
    ".button",
    "[role='button']",
    "summary",
    "label",
    ".nav-toggle",
    ".nav-dropdown-toggle",
    ".customer-logo-card",
    ".job-public-link",
    ".card",
    ".hero-card",
    ".stat",
    ".timeline-item",
    ".status-card",
    ".status-kpi",
  ].join(",");
  const textSelector = "input, textarea, select, [contenteditable='true']";

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let rafId = 0;

  const setCursorState = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const isTextField = Boolean(target?.closest(textSelector));
    const isHovering = Boolean(target?.closest(interactiveSelector)) && !isTextField;
    cursor.classList.toggle("is-hovering", isHovering);
    dot.classList.toggle("is-hovering", isHovering);
    cursor.classList.toggle("is-text-field", isTextField);
    dot.classList.toggle("is-text-field", isTextField);
  };

  const render = () => {
    currentX += (targetX - currentX) * 0.24;
    currentY += (targetY - currentY) * 0.24;
    cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    rafId = window.requestAnimationFrame(render);
  };

  const show = () => {
    cursor.classList.remove("is-hidden");
    dot.classList.remove("is-hidden");
  };

  const hide = () => {
    cursor.classList.add("is-hidden");
    dot.classList.add("is-hidden");
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      setCursorState(event);
      show();
      if (!rafId) render();
    },
    { passive: true }
  );

  document.addEventListener("pointerdown", () => {
    cursor.classList.add("is-pressed");
  });

  document.addEventListener("pointerup", () => {
    cursor.classList.remove("is-pressed");
  });

  document.addEventListener("pointerleave", hide);
  window.addEventListener("blur", hide);

  finePointer.addEventListener?.("change", (event) => {
    if (!event.matches) {
      window.cancelAnimationFrame(rafId);
      document.body.classList.remove("has-custom-cursor");
      cursor.remove();
      dot.remove();
    }
  });
};

setupCustomCursor();

const updateScrollState = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  document.body.classList.toggle("is-scrolled", window.scrollY > 8);
};

updateScrollState();
window.addEventListener("scroll", updateScrollState, { passive: true });
window.addEventListener("resize", updateScrollState);

const revealElements = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.15 }
);

revealElements.forEach((el) => revealObserver.observe(el));

const page = document.body.dataset.page;
const navLinks = document.querySelectorAll(".nav-links a");
navLinks.forEach((link) => {
  if (link.dataset.page === page) {
    link.classList.add("active");
  }
});

const navToggle = document.querySelector("[data-nav-toggle]");
const navLinksWrap = document.querySelector("[data-nav-links]");
if (navToggle && navLinksWrap) {
  navToggle.addEventListener("click", () => {
    const open = navLinksWrap.classList.toggle("open");
    navToggle.classList.toggle("active", open);
    navToggle.setAttribute("aria-expanded", String(open));
  });

  navLinksWrap.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 980) {
        navLinksWrap.classList.remove("open");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
      navLinksWrap.classList.remove("open");
      navToggle.classList.remove("active");
      navToggle.setAttribute("aria-expanded", "false");
      document.querySelector(".nav-dropdown")?.classList.remove("open");
    }
  });
}

const dropdownToggle = document.querySelector(".nav-dropdown-toggle");
const dropdown = document.querySelector(".nav-dropdown");
if (dropdownToggle && dropdown) {
  dropdownToggle.addEventListener("click", (event) => {
    if (window.innerWidth <= 980) {
      event.preventDefault();
      dropdown.classList.toggle("open");
    }
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth <= 980 && !dropdown.contains(event.target)) {
      dropdown.classList.remove("open");
    }
  });
}

const orbs = document.querySelectorAll(".orb");
window.addEventListener("mousemove", (event) => {
  const { innerWidth, innerHeight } = window;
  const offsetX = (event.clientX / innerWidth - 0.5) * 10;
  const offsetY = (event.clientY / innerHeight - 0.5) * 10;
  orbs.forEach((orb, index) => {
    const factor = (index + 1) * 0.6;
    orb.style.transform = `translate(${offsetX * factor}px, ${offsetY * factor}px)`;
  });
});

const canUsePointerEffects = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const tiltTargets = document.querySelectorAll(
  ".card, .stat, .timeline-item, .hero-card, .game-promo-grid, .status-card, .status-kpi, .job-card, .job-brief, .job-visual-card"
);

if (canUsePointerEffects && !prefersReducedMotion.matches) {
  tiltTargets.forEach((target) => {
    target.addEventListener("mousemove", (event) => {
      const rect = target.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      target.style.setProperty("--tilt-rx", `${(-y * 5).toFixed(2)}deg`);
      target.style.setProperty("--tilt-ry", `${(x * 5).toFixed(2)}deg`);
    });

    target.addEventListener("mouseleave", () => {
      target.style.removeProperty("--tilt-rx");
      target.style.removeProperty("--tilt-ry");
    });
  });
}

const statNumbers = document.querySelectorAll(".stat h4");
const statObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.counted === "true") return;
      const label = entry.target.textContent.trim();
      const match = label.match(/^(\d+)(.*)$/);
      if (!match || prefersReducedMotion.matches) {
        entry.target.dataset.counted = "true";
        return;
      }

      const end = Number(match[1]);
      const suffix = match[2];
      const startedAt = performance.now();
      const duration = 900;
      entry.target.dataset.counted = "true";

      const tick = (now) => {
        const amount = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - amount, 3);
        entry.target.textContent = `${Math.round(end * eased)}${suffix}`;
        if (amount < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  },
  { threshold: 0.45 }
);

statNumbers.forEach((stat) => statObserver.observe(stat));

const formResponse = document.querySelector("[data-form-response]");
if (formResponse) {
  formResponse.textContent =
    "Submitting the form will send your request directly to JC IT Services.";
}

const cookieBanner = document.querySelector("[data-cookie-banner]");
if (cookieBanner) {
  const accepted = localStorage.getItem("jc_cookie_ack") === "true";
  if (!accepted) {
    cookieBanner.classList.add("visible");
  }
  const acceptBtn = cookieBanner.querySelector("[data-cookie-accept]");
  const dismissBtn = cookieBanner.querySelector("[data-cookie-dismiss]");
  const hide = () => {
    cookieBanner.classList.remove("visible");
    localStorage.setItem("jc_cookie_ack", "true");
  };
  if (acceptBtn) acceptBtn.addEventListener("click", hide);
  if (dismissBtn) dismissBtn.addEventListener("click", hide);
}

const openRetellWidget = () => {
  const candidates = [
    window.Retell,
    window.retellWidget,
    window.RetellWidget,
    window.retellAI,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate.open === "function") {
      candidate.open();
      return true;
    }
  }
  return false;
};

document.querySelectorAll("[data-open-retell]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (!openRetellWidget()) {
      console.warn("Retell widget is not ready yet.");
    }
  });
});

const hideLoader = () => {
  if (!pageLoader) return;
  pageLoader.classList.add("hidden");
  document.body.classList.remove("loader-active");
  window.setTimeout(() => {
    pageLoader.remove();
  }, 460);
};

window.addEventListener("load", hideLoader);
window.setTimeout(hideLoader, 2600);

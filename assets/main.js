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

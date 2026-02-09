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

document.addEventListener("DOMContentLoaded", () => {

  // ===== NAVBAR MOBILE FIX (links + botones) =====
  const navLinks = document.querySelectorAll(
    ".navbar .nav-link, .navbar .btn"
  );
  const navbarCollapse = document.querySelector(".navbar-collapse");
  const navbar = document.querySelector(".navbar");

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (navbarCollapse && navbarCollapse.classList.contains("show")) {
        const bsCollapse =
          bootstrap.Collapse.getInstance(navbarCollapse) ||
          new bootstrap.Collapse(navbarCollapse, { toggle: false });

        bsCollapse.hide();
      }
    });
  });

  // ===== NAVBAR SCROLL EFFECT =====
  const handleNavbarScroll = () => {
    if (!navbar) return;

    if (window.scrollY > 20) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  };

  handleNavbarScroll();
  window.addEventListener("scroll", handleNavbarScroll);


  // ===== CRM LOGIN LINKS (Portal Login) =====
  const crmLinks = document.querySelectorAll(".crm-login-link");

  crmLinks.forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

});
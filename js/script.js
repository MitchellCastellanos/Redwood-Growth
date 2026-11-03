/* Redwood Growth — site behavior (Bootstrap handles collapse + accordion) */
document.addEventListener("DOMContentLoaded", () => {
  // Footer year
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Header shadow on scroll
  const header = document.getElementById("siteHeader");
  const onScroll = () => header && header.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Close mobile nav after choosing a link
  const nav = document.getElementById("mainNav");
  if (nav && window.bootstrap) {
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        if (nav.classList.contains("show")) bootstrap.Collapse.getOrCreateInstance(nav).hide();
      })
    );
  }

  // Active nav link while scrolling (home page only)
  const links = [...document.querySelectorAll('.navbar-nav .nav-link[href^="#"]')];
  const targets = links.map((l) => document.querySelector(l.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && targets.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => {
              const on = l.getAttribute("href") === "#" + e.target.id;
              l.classList.toggle("active", on);
              on ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current");
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    targets.forEach((t) => io.observe(t));
  }

  // Subtle reveal on scroll (respects reduced motion via CSS)
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    const ro = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    reveals.forEach((r) => ro.observe(r));
  } else {
    reveals.forEach((r) => r.classList.add("in"));
  }

  // Comparison table: show a scroll affordance while more content is off-screen
  const shell = document.getElementById("compareShell");
  const scroller = document.getElementById("compareScroll");
  if (shell && scroller) {
    const update = () => {
      const more = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 4;
      shell.classList.toggle("can-scroll", more);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }
});

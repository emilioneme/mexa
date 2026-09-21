// Lightweight, dependency-free parallax effect driven purely by scroll position.
// Any element with [data-parallax] and a data-speed attribute will translate
// vertically at a fraction/multiple of scroll speed.

(function () {
  let parallaxElements = [];
  let ticking = false;

  function cacheElements() {
    parallaxElements = Array.from(document.querySelectorAll("[data-parallax]"));
  }

  function updateParallax() {
    const viewportH = window.innerHeight;

    parallaxElements.forEach((el) => {
      const speed = parseFloat(el.getAttribute("data-speed")) || 0.2;
      const rect = el.getBoundingClientRect();
      const centerOffset = rect.top + rect.height / 2 - viewportH / 2;
      el.style.transform = `translate3d(0, ${centerOffset * speed * -1}px, 0)`;
    });

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }

  function init() {
    cacheElements();
    if (parallaxElements.length === 0) return;
    updateParallax();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateParallax);
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("mexa:components-loaded", init);
})();
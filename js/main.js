// Orchestrates the page: loads HTML components, wires up header/nav
// behaviour, scroll reveals, and image fallback-to-big-letter rendering.

(function () {
  async function includeComponents() {
    const mounts = Array.from(document.querySelectorAll("[data-include]"));

    await Promise.all(
      mounts.map(async (mount) => {
        const url = mount.getAttribute("data-include");
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load ${url}`);
          mount.outerHTML = await res.text();
        } catch (err) {
          console.error(err);
          mount.innerHTML = `<p style="color:#c66">Could not load component: ${url}</p>`;
        }
      })
    );

    document.dispatchEvent(new CustomEvent("mexa:components-loaded"));
  }

  function initHeroShadowToggle() {
    const hero = document.querySelector(".hero");
    const brands = document.querySelector(".brands");
    const toggle = document.querySelector("[data-hero-shadow-toggle]");
    if (!hero || !toggle) return;

    const targets = [hero, brands].filter(Boolean);

    // Off by default: dark mode starts disabled (sections keep their shadow).
    targets.forEach((el) => el.classList.remove("hero--no-shadow"));
    toggle.setAttribute("aria-checked", "false");

    toggle.addEventListener("click", () => {
      const isOn = toggle.getAttribute("aria-checked") === "true";
      const next = !isOn;
      toggle.setAttribute("aria-checked", String(next));
      targets.forEach((el) => el.classList.toggle("hero--no-shadow", next));
    });
  }

  function initHeader() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".site-header nav");
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        nav.classList.toggle("is-open");
      });
      nav.querySelectorAll("a").forEach((link) =>
        link.addEventListener("click", () => nav.classList.remove("is-open"))
      );
    }
  }

  function initReveal() {
    const targets = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || targets.length === 0) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    targets.forEach((el) => observer.observe(el));
  }

  // Any <img> can opt in to the "big letter" fallback by giving its
  // container a [data-fallback-letter] attribute. If the image 404s (as
  // placeholders will), we hide it and let the CSS ::before render the
  // initial in a big, bold font filling the rectangle.
  function applyImageFallbacks(scope = document) {
    const containers = scope.querySelectorAll("[data-fallback-letter]");

    containers.forEach((container) => {
      const img = container.querySelector("img");
      if (!img) return;

      const activateFallback = () => {
        container.classList.add("img-fallback");
        container.setAttribute("data-fallback", container.getAttribute("data-fallback-letter"));
        img.style.display = "none";
      };

      if (img.complete && img.naturalWidth === 0) {
        activateFallback();
      } else {
        img.addEventListener("error", activateFallback, { once: true });
      }
    });
  }

  document.addEventListener("mexa:components-loaded", () => {
    initHeader();
    initHeroShadowToggle();
    initReveal();
    applyImageFallbacks();
  });

  window.addEventListener("mexa:apply-fallbacks", () => applyImageFallbacks());

  document.addEventListener("DOMContentLoaded", includeComponents);
})();
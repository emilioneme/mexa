// Vanilla Brand — simple vanilla JS driving the carousels and the
// product category toggle. No build step, no dependencies.

(function () {
  /* ---------------------------------------------------------------------
     Loads each [data-include] mount point's HTML component from the
     components/ folder before the rest of the page initializes.
  --------------------------------------------------------------------- */
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
  }

  /* ---------------------------------------------------------------------
     Generic carousel: works for the hero and the info section alike.
     Expects a root element with:
       .carousel__track > .carousel__slide (repeated)
       .carousel__arrow--prev / --next
       .carousel__dots > .carousel__dot (built dynamically)
  --------------------------------------------------------------------- */
  function initCarousel(root, { autoplay = false, interval = 6000 } = {}) {
    const track = root.querySelector(".carousel__track");
    const slides = Array.from(root.querySelectorAll(".carousel__slide"));
    const dotsWrap = root.querySelector(".carousel__dots");
    const prevBtn = root.querySelector(".carousel__arrow--prev");
    const nextBtn = root.querySelector(".carousel__arrow--next");
    let index = 0;
    let timer = null;

    if (!track || slides.length === 0) return;

    // Build dots
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className = "carousel__dot";
        dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
        dot.addEventListener("click", () => goTo(i));
        dotsWrap.appendChild(dot);
      });
    }

    function update() {
      track.style.transform = `translateX(-${index * 100}%)`;
      if (dotsWrap) {
        Array.from(dotsWrap.children).forEach((dot, i) =>
          dot.classList.toggle("is-active", i === index)
        );
      }
    }

    function goTo(i) {
      index = (i + slides.length) % slides.length;
      update();
      resetAutoplay();
    }

    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    function resetAutoplay() {
      if (!autoplay) return;
      clearInterval(timer);
      timer = setInterval(next, interval);
    }

    prevBtn && prevBtn.addEventListener("click", prev);
    nextBtn && nextBtn.addEventListener("click", next);

    update();
    resetAutoplay();
  }

  /* ---------------------------------------------------------------------
     Product category toggle + rendering
  --------------------------------------------------------------------- */
  function initProducts() {
    const grid = document.querySelector("[data-products-grid]");
    const toggleWrap = document.querySelector("[data-category-toggle]");
    if (!grid || !window.VANILLA_PRODUCTS) return;

    // Build the category filter buttons from data, using logo images
    // instead of emoji icons.
    if (toggleWrap && window.VANILLA_CATEGORIES) {
      toggleWrap.innerHTML = window.VANILLA_CATEGORIES
        .map(
          (c) => `
        <button class="category-toggle__item" data-category="${c.id}">
          <span class="category-toggle__icon">
            <img src="${c.logo}" alt="${c.label}" loading="lazy">
          </span>
          <span class="category-toggle__label">${c.label}</span>
        </button>`
        )
        .join("");
    }

    const toggles = Array.from(document.querySelectorAll(".category-toggle__item"));
    if (toggles.length === 0) return;

    function render(category) {
      const items =
        category === "all"
          ? window.VANILLA_PRODUCTS
          : window.VANILLA_PRODUCTS.filter((p) => p.category === category);
      grid.innerHTML = items
        .map(
          (p) => `
        <article class="product-card">
          <div class="product-card__image">${p.image ? `<img src="${p.image}" alt="${p.name}">` : "No Image"}</div>
          <div class="product-card__body">
            <h3 class="product-card__name">${p.name}</h3>
            <p class="product-card__desc">${p.description}</p>
            <span class="product-card__price">${p.price}</span>
          </div>
        </article>`
        )
        .join("");
    }

    toggles.forEach((btn) => {
      btn.addEventListener("click", () => {
        toggles.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        render(btn.dataset.category);
      });
    });

    // Default to first category
    if (toggles[0]) {
      toggles[0].classList.add("is-active");
      render(toggles[0].dataset.category);
    }
  }

  /* ---------------------------------------------------------------------
     Hero carousel content injection (data-oriented, click-through links)
  --------------------------------------------------------------------- */
  function initHeroSlides() {
    const track = document.querySelector("[data-hero-track]");
    if (!track || !window.VANILLA_HERO_SLIDES) return;

    track.innerHTML = window.VANILLA_HERO_SLIDES
      .map((s) => {
        const tag = s.link ? "a" : "div";
        const href = s.link ? ` href="${s.link}"` : "";
        return `
      <${tag} class="carousel__slide hero__slide"${href}>
        ${s.image ? `<img src="${s.image}" alt="${s.title || ""}">` : ""}
        <div class="hero__caption">
          ${s.eyebrow ? `<span class="eyebrow">${s.eyebrow}</span>` : ""}
          ${s.title ? `<h2>${s.title}</h2>` : ""}
        </div>
      </${tag}>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await includeComponents();

    initHeroSlides();
    initProducts();

    const hero = document.querySelector("[data-carousel='hero']");
    if (hero) initCarousel(hero, { autoplay: true, interval: 5000 });

    const info = document.querySelector("[data-carousel='info']");
    if (info) initCarousel(info, { autoplay: false });
  });
})();

// Renders the brand showcase grid. Data lives in js/data/brands.data.js.
// Images are optional — missing/broken images automatically fall back to a
// big initial letter (handled in main.js). If a brand has a `website`, the
// whole card links out to it (opens in a new tab).

(function () {
  function buildGrid(container) {
    if (!container) return;

    const brands = window.MEXA_BRANDS || [];

    container.innerHTML = brands.map((brand) => {
      const initial = brand.name.trim().charAt(0).toUpperCase();
      const slug = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const image = brand.image || `assets/brands/${slug}.jpg`;
      const tag = brand.website ? "a" : "div";
      const linkAttrs = brand.website
        ? `href="${brand.website}" target="_blank" rel="noopener noreferrer"`
        : "";
      return `
        <${tag} class="brand-item" data-parallax data-speed="0.06" data-fallback-letter="${initial}" ${linkAttrs}>
          <img src="${image}" alt="${brand.name}" />
          <div class="brand-item__overlay">
            <h3>${brand.name}</h3>
            <p>${brand.tag}</p>
          </div>
        </${tag}>`;
    }).join("");
  }

  function init() {
    buildGrid(document.querySelector("[data-brands-grid]"));
    window.dispatchEvent(new CustomEvent("mexa:apply-fallbacks"));
  }

  document.addEventListener("mexa:components-loaded", init);
})();
// Builds the infinite partners marquee. Data lives in js/data/partners.data.js.
// Images are optional — if one 404s, mexa:apply-fallbacks (main.js) swaps it
// for a big-letter block. If a partner has a `website`, its logo links out
// to it (opens in a new tab).
//
// The track is made of two identical "halves" (so the -50% CSS animation
// loops seamlessly). Each half repeats the partner list as many times as
// needed to be at least as wide as the viewport, so the strip always fills
// the screen edge-to-edge no matter how few partners are configured.

(function () {
  function renderSet(partners) {
    return partners
      .map((p) => {
        const initial = p.name.trim().charAt(0).toUpperCase();
        const image = p.image || `assets/partners/${p.name.toLowerCase().replace(/\s+/g, "-")}.png`;
        const tag = p.website ? "a" : "div";
        const linkAttrs = p.website
          ? `href="${p.website}" target="_blank" rel="noopener noreferrer"`
          : "";
        const bgColor = p.bgColor || "transparent";
        return `
          <${tag} class="partner-logo" data-fallback-letter="${initial}" style="background-color: ${bgColor};" ${linkAttrs}>
            <img src="${image}" alt="${p.name} logo" />
          </${tag}>`;
      })
      .join("");
  }

  function buildTrack(track) {
    if (!track) return;

    const partners = window.MEXA_PARTNERS || [];
    if (partners.length === 0) return;

    const singleSetHtml = renderSet(partners);

    // Measure one set's rendered width to know how many copies fill the viewport.
    track.innerHTML = singleSetHtml;
    const setWidth = track.scrollWidth || 1;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const copiesNeeded = Math.max(1, Math.ceil(viewportWidth / setWidth)) + 1;

    const half = singleSetHtml.repeat(copiesNeeded);
    track.innerHTML = half + half;

    // Keep a constant scroll speed (px/sec) regardless of how many copies
    // were needed to fill the viewport, so more partners don't speed up
    // (or fewer partners slow down) the marquee.
    const pxPerSecond = 60;
    const halfWidth = track.scrollWidth / 2 || viewportWidth;
    track.style.animationDuration = `${halfWidth / pxPerSecond}s`;
  }

  function init() {
    const track = document.querySelector("[data-partners-track]");
    if (track) buildTrack(track);
    window.dispatchEvent(new CustomEvent("mexa:apply-fallbacks"));
  }

  document.addEventListener("mexa:components-loaded", init);
  window.addEventListener("resize", () => {
    const track = document.querySelector("[data-partners-track]");
    if (track) buildTrack(track);
    window.dispatchEvent(new CustomEvent("mexa:apply-fallbacks"));
  });
})();
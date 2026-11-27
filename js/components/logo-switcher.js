// Logo switcher — a floating picker for previewing the MEXAM logo
// directions in assets/logo/. Any <img data-logo-slot="..."> shows that file
// of the chosen logo (slots: mark, mark-dark, lockup, lockup-dark, icon), and
// the favicon follows along. The choice is remembered in localStorage and can
// be shared as a link with ?logo=<id> (e.g. ?logo=refresh).
// To remove it, delete this script, its CSS file and their tags in index.html;
// the header and footer then show the src written in components/header.html
// and components/footer.html.

(function () {
  const STORAGE_KEY = "mexam-logo";
  const BASE = "assets/logo/";
  const logos = window.MEXAM_LOGOS || [];
  const fallback = window.MEXAM_DEFAULT_LOGO || (logos[0] && logos[0].id);
  const known = (id) => logos.some((logo) => logo.id === id);

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  const fromUrl = new URLSearchParams(window.location.search).get("logo");
  const stored = readStored();
  let current = fallback;
  if (fromUrl !== null && known(fromUrl)) current = fromUrl;
  else if (stored !== null && known(stored)) current = stored;

  // Points every logo slot (and the favicon) at the current logo's files.
  function paint() {
    document.querySelectorAll("img[data-logo-slot]").forEach((img) => {
      const src = `${BASE}${current}/${img.dataset.logoSlot}.svg`;
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    });

    const favicon = document.getElementById("site-favicon");
    const iconHref = `${BASE}${current}/icon.svg`;
    if (favicon && favicon.getAttribute("href") !== iconHref) favicon.setAttribute("href", iconHref);

    document.querySelectorAll(".logo-switcher__option").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.logoId === current));
    });
  }

  function applyLogo(id) {
    if (!known(id)) return;
    current = id;
    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* private mode */ }

    // Keep ?logo= in the address bar in sync so the current URL is shareable.
    const url = new URL(window.location.href);
    url.searchParams.set("logo", id);
    history.replaceState(null, "", url);

    paint();
  }

  function buildPicker() {
    const wrap = document.createElement("div");
    wrap.className = "logo-switcher";
    wrap.innerHTML = `
      <button class="logo-switcher__toggle" type="button" aria-expanded="false" aria-controls="logo-switcher-panel">
        <img class="logo-switcher__toggle-icon" data-logo-slot="icon" src="${BASE}${current}/icon.svg" alt="">
        Logos
      </button>
      <div class="logo-switcher__panel" id="logo-switcher-panel" role="group" aria-label="Logo" hidden></div>
    `;
    document.body.appendChild(wrap);

    const panel = wrap.querySelector(".logo-switcher__panel");
    const toggle = wrap.querySelector(".logo-switcher__toggle");

    logos.forEach((logo) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "logo-switcher__option";
      btn.dataset.logoId = logo.id;
      btn.setAttribute("aria-pressed", String(logo.id === current));
      btn.innerHTML = `
        <span class="logo-switcher__preview" aria-hidden="true">
          <img src="${BASE}${logo.id}/lockup-dark.svg" alt="">
        </span>
        <span class="logo-switcher__name">${logo.name}</span>
      `;
      btn.addEventListener("click", () => applyLogo(logo.id));
      panel.appendChild(btn);
    });

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", () => setOpen(panel.hidden));
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  // The header and footer arrive later via data-include, so repaint whenever
  // new elements are added (this runs before the browser draws them).
  new MutationObserver(paint).observe(document.documentElement, { childList: true, subtree: true });
  paint();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPicker);
  else buildPicker();
})();

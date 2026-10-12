// Theme switcher — a floating picker for previewing the palettes in
// css/themes/. The choice is remembered in localStorage and can be
// shared as a link with ?theme=<id> (e.g. ?theme=cured-bean).
// To remove it, delete this script, its CSS file and their tags in index.html.

(function () {
  const STORAGE_KEY = "vanilla-theme";
  const themes = window.VANILLA_THEMES || [];
  const root = document.documentElement;
  const known = (id) => themes.some((t) => t.id === id);

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function applyTheme(id, { save = true } = {}) {
    if (id) root.setAttribute("data-theme", id);
    else root.removeAttribute("data-theme");

    if (save) {
      try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* private mode */ }
    }

    // Keep ?theme= in the address bar in sync so the current URL is shareable.
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("theme", id);
    else url.searchParams.delete("theme");
    history.replaceState(null, "", url);

    document.querySelectorAll(".theme-switcher__option").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeId === id));
    });
  }

  // Run immediately (script is loaded in <head>) to avoid a flash of the
  // default palette before the chosen one applies.
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  const stored = readStored();
  let initial = root.getAttribute("data-theme") || "";
  if (fromUrl !== null && known(fromUrl)) initial = fromUrl;
  else if (stored !== null && known(stored)) initial = stored;
  if (initial) root.setAttribute("data-theme", initial);
  else root.removeAttribute("data-theme");

  // Reads a theme's colors straight from the CSS so swatches never drift
  // out of sync with css/themes/.
  function swatchColors(id) {
    const vars = ["--palette-base", "--palette-deep", "--palette-accent"];
    // The default palette lives on :root, so read it with <html>'s theme
    // briefly removed; named themes are read from a hidden probe element.
    if (!id) {
      const current = root.getAttribute("data-theme");
      root.removeAttribute("data-theme");
      const colors = vars.map((v) => getComputedStyle(root).getPropertyValue(v).trim());
      if (current) root.setAttribute("data-theme", current);
      return colors;
    }
    const probe = document.createElement("div");
    probe.setAttribute("data-theme", id);
    probe.style.display = "none";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const colors = vars.map((v) => cs.getPropertyValue(v).trim());
    probe.remove();
    return colors;
  }

  function buildPicker() {
    const wrap = document.createElement("div");
    wrap.className = "theme-switcher";
    wrap.innerHTML = `
      <button class="theme-switcher__toggle" type="button" aria-expanded="false" aria-controls="theme-switcher-panel">
        <span class="theme-switcher__toggle-dot" aria-hidden="true"></span>
        Themes
      </button>
      <div class="theme-switcher__panel" id="theme-switcher-panel" role="group" aria-label="Color theme" hidden></div>
    `;
    document.body.appendChild(wrap);

    const panel = wrap.querySelector(".theme-switcher__panel");
    const toggle = wrap.querySelector(".theme-switcher__toggle");

    themes.forEach((theme) => {
      const [bg, dark, accent] = swatchColors(theme.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-switcher__option";
      btn.dataset.themeId = theme.id;
      btn.setAttribute("aria-pressed", String(theme.id === (root.getAttribute("data-theme") || "")));
      btn.innerHTML = `
        <span class="theme-switcher__swatch" aria-hidden="true">
          <span style="background:${bg}"></span><span style="background:${dark}"></span><span style="background:${accent}"></span>
        </span>
        <span class="theme-switcher__name">${theme.name}</span>
      `;
      btn.addEventListener("click", () => applyTheme(theme.id));
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPicker);
  else buildPicker();
})();

// Theme builder — design a new palette live on the page, then download it
// as a ready-to-add file for css/themes/. Opens from "Create theme" in the
// theme switcher. The draft is kept in localStorage, and "Copy preview link"
// shares it with anyone as ?draft=... (nothing is saved to the server).
// To remove it, delete this script, its CSS file and their tags in index.html.

(function () {
  const STORAGE_KEY = "vanilla-theme-draft";
  const URL_PARAM = "draft";
  const root = document.documentElement;
  const themes = window.VANILLA_THEMES || [];

  // Mirrors css/themes/_template.css: [key, label, comment in the file].
  const GROUPS = [
    {
      title: "Light areas",
      hint: "Page, header, categories, cards",
      fields: [
        ["base", "Page background", "page background"],
        ["surface", "Cards & panels", "cards, panels, hover/active fills"],
        ["ink", "Main text", "main text"],
        ["ink-soft", "Secondary text", "secondary text (descriptions)"],
        ["line", "Borders", "borders on light areas"]
      ]
    },
    {
      title: "Accent",
      hint: "Prices, eyebrows, active states",
      fields: [
        ["accent", "Accent", "prices, eyebrows, active states"],
        ["accent-soft", "Soft accent", "softer accent: headings on deep areas, hovers"]
      ]
    },
    {
      title: "Deep areas",
      hint: "Info section, footer",
      fields: [
        ["deep", "Background", "background of the bold sections"],
        ["deep-alt", "Inner panels", "panels inside deep sections"],
        ["on-deep", "Text", "text on deep sections, accent fills and photos"],
        ["line-deep", "Borders", "borders inside deep sections"]
      ]
    }
  ];
  const FIELDS = GROUPS.flatMap((g) => g.fields);
  const KEYS = FIELDS.map((f) => f[0]);

  // Text/background pairs worth checking for readability (WCAG AA = 4.5).
  const CONTRAST_CHECKS = [
    ["ink", "base", "Main text on page"],
    ["ink-soft", "surface", "Secondary text on cards"],
    ["accent", "base", "Accent on page"],
    ["on-deep", "deep", "Text on deep areas"],
    ["accent-soft", "deep", "Soft accent on deep areas"]
  ];

  let draft = null;   // { name, from, dark, palette: { base: "#rrggbb", ... } }
  let panel = null;

  /* ---------------------------------------------------------------------
     Color helpers
  --------------------------------------------------------------------- */
  const ctx = document.createElement("canvas").getContext("2d");

  // Any CSS color -> "#rrggbb" (null if it isn't a valid color).
  function toHex(value) {
    const v = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(v)) return ("#" + v.slice(1).split("").map((c) => c + c).join("")).toLowerCase();
    ctx.fillStyle = "#010203";
    ctx.fillStyle = v;
    const out = ctx.fillStyle;
    if (out === "#010203" && v.toLowerCase() !== "#010203") return null;
    return /^#[0-9a-f]{6}$/i.test(out) ? out.toLowerCase() : null;
  }

  function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* ---------------------------------------------------------------------
     Reading existing themes straight from their CSS files
  --------------------------------------------------------------------- */
  function readTheme(id) {
    const probe = document.createElement("div");
    probe.setAttribute("data-theme", id || "vanilla-bean");
    probe.style.display = "none";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const palette = {};
    KEYS.forEach((k) => { palette[k] = toHex(cs.getPropertyValue(`--palette-${k}`)) || "#000000"; });
    const dark = cs.colorScheme.trim() === "dark";
    probe.remove();
    return { palette, dark };
  }

  function themeName(id) {
    const t = themes.find((x) => x.id === id);
    return t ? t.name : id;
  }

  function slugify(name) {
    return String(name)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "my-theme";
  }

  function existingIds() {
    return themes.map((t) => t.id || "vanilla-bean");
  }

  /* ---------------------------------------------------------------------
     Draft: load / save / share
  --------------------------------------------------------------------- */
  // Accepts untrusted input (localStorage or a shared link) and returns a
  // clean draft, or null if it doesn't look like one.
  function sanitize(raw) {
    if (!raw || typeof raw !== "object" || !raw.palette) return null;
    const palette = {};
    for (const k of KEYS) {
      const hex = toHex(raw.palette[k]);
      if (!hex || !/^#[0-9a-f]{6}$/.test(hex)) return null;
      palette[k] = hex;
    }
    return {
      name: String(raw.name || "My Theme").slice(0, 40),
      from: typeof raw.from === "string" && themes.some((t) => t.id === raw.from) ? raw.from : "",
      dark: Boolean(raw.dark),
      palette
    };
  }

  function encodeDraft(d) {
    const json = JSON.stringify(d);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeDraft(str) {
    try {
      const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
      return sanitize(JSON.parse(decodeURIComponent(escape(atob(b64)))));
    } catch (e) {
      return null;
    }
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch (e) { /* private mode */ }
  }

  function loadSavedDraft() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch (e) { return null; }
  }

  function newDraftFrom(id) {
    const { palette, dark } = readTheme(id);
    return { name: "My Theme", from: id, dark, palette };
  }

  function setUrlDraft(value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(URL_PARAM, value);
    else url.searchParams.delete(URL_PARAM);
    history.replaceState(null, "", url);
  }

  /* ---------------------------------------------------------------------
     Live preview: inline --palette-* on <html> beats any theme file.
  --------------------------------------------------------------------- */
  function applyPreview() {
    KEYS.forEach((k) => root.style.setProperty(`--palette-${k}`, draft.palette[k]));
    root.style.colorScheme = draft.dark ? "dark" : "light";
  }

  function clearPreview() {
    KEYS.forEach((k) => root.style.removeProperty(`--palette-${k}`));
    root.style.removeProperty("color-scheme");
  }

  /* ---------------------------------------------------------------------
     Output: the theme file, in the same shape as css/themes/_template.css
  --------------------------------------------------------------------- */
  function safeName() {
    return draft.name.replace(/\*\//g, "").replace(/["\\]/g, "").trim() || "My Theme";
  }

  function buildCss() {
    const id = slugify(draft.name);
    const date = new Date().toISOString().slice(0, 10);
    const line = (k, comment) => {
      const decl = `  --palette-${k}: ${draft.palette[k]};`;
      return `${decl.padEnd(37)}/* ${comment} */`;
    };
    const groupBlocks = GROUPS.map((g) => g.fields.map(([k, , c]) => line(k, c)).join("\n"));

    return `/* ==========================================================================
   THEME — "${safeName()}"
   Made with the theme builder on ${date}.
   ========================================================================== */
[data-theme="${id}"] {
${draft.dark ? "  color-scheme: dark;\n\n" : ""}${groupBlocks.join("\n\n")}
}
`;
  }

  function setupSteps() {
    const id = slugify(draft.name);
    return [
      `css/themes/${id}.css`,
      `<link rel="stylesheet" href="css/themes/${id}.css">`,
      `{ id: "${id}", name: "${safeName()}" },`
    ];
  }

  function download() {
    const blob = new Blob([buildCss()], { type: "text/css" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slugify(draft.name)}.css`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    status("Downloaded. See “Adding it to the site” below.");
  }

  async function copy(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
      status(okMessage);
    } catch (e) {
      window.prompt("Copy this:", text);
    }
  }

  function status(message) {
    const el = panel.querySelector(".theme-builder__status");
    el.textContent = message;
    clearTimeout(status.timer);
    status.timer = setTimeout(() => { el.textContent = ""; }, 4000);
  }

  /* ---------------------------------------------------------------------
     Panel
  --------------------------------------------------------------------- */
  function buildPanel() {
    panel = document.createElement("aside");
    panel.className = "theme-builder";
    panel.setAttribute("aria-label", "Theme builder");
    panel.hidden = true;
    panel.innerHTML = `
      <div class="theme-builder__head">
        <strong class="theme-builder__title">Theme builder</strong>
        <button type="button" class="theme-builder__icon" data-action="collapse" aria-expanded="true" title="Minimize">&minus;</button>
        <button type="button" class="theme-builder__icon" data-action="close" title="Close and stop previewing">&times;</button>
      </div>
      <div class="theme-builder__body">
        <label class="theme-builder__field">
          <span>Theme name</span>
          <input type="text" name="name" maxlength="40" autocomplete="off">
        </label>
        <p class="theme-builder__meta">File: <code data-out="file"></code><span class="theme-builder__warn" data-out="id-warning"></span></p>

        <label class="theme-builder__field">
          <span>Start from</span>
          <select name="from"></select>
        </label>
        <label class="theme-builder__check">
          <input type="checkbox" name="dark"> Dark theme <small>(dark scrollbars &amp; form controls)</small>
        </label>

        <div data-out="groups"></div>

        <div class="theme-builder__group">
          <p class="theme-builder__legend">Readability</p>
          <ul class="theme-builder__checks" data-out="checks"></ul>
        </div>

        <div class="theme-builder__actions">
          <button type="button" class="theme-builder__btn theme-builder__btn--primary" data-action="download">Download theme file</button>
          <button type="button" class="theme-builder__btn" data-action="copy-css">Copy CSS</button>
          <button type="button" class="theme-builder__btn" data-action="share">Copy preview link</button>
        </div>
        <p class="theme-builder__status" role="status" aria-live="polite"></p>

        <details class="theme-builder__steps">
          <summary>Adding it to the site</summary>
          <ol>
            <li>Save the downloaded file as <code data-out="step-0"></code></li>
            <li>In <code>index.html</code>, next to the other themes:<code class="theme-builder__snippet" data-out="step-1"></code></li>
            <li>In <code>js/data/themes.data.js</code>:<code class="theme-builder__snippet" data-out="step-2"></code></li>
          </ol>
        </details>
      </div>
    `;

    // "Start from" options
    const select = panel.querySelector('select[name="from"]');
    themes.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    });

    // Color rows
    const groupsWrap = panel.querySelector('[data-out="groups"]');
    GROUPS.forEach((g) => {
      const group = document.createElement("div");
      group.className = "theme-builder__group";
      const legend = document.createElement("p");
      legend.className = "theme-builder__legend";
      legend.textContent = g.title;
      const hint = document.createElement("small");
      hint.textContent = g.hint;
      legend.appendChild(hint);
      group.appendChild(legend);

      g.fields.forEach(([key, label]) => {
        const row = document.createElement("label");
        row.className = "theme-builder__color";
        row.innerHTML = `
          <input type="color" data-key="${key}">
          <span class="theme-builder__color-label"></span>
          <input type="text" class="theme-builder__hex" data-hex="${key}" maxlength="7" spellcheck="false" aria-label="${label} hex value">
        `;
        row.querySelector(".theme-builder__color-label").textContent = label;
        group.appendChild(row);
      });
      groupsWrap.appendChild(group);
    });

    document.body.appendChild(panel);
    wirePanel();
  }

  function wirePanel() {
    panel.addEventListener("input", (e) => {
      const t = e.target;
      if (t.name === "name") {
        draft.name = t.value;
        renderOutputs();
      } else if (t.dataset.key) {
        draft.palette[t.dataset.key] = t.value.toLowerCase();
        panel.querySelector(`[data-hex="${t.dataset.key}"]`).value = t.value.toLowerCase();
        onPaletteChange();
      } else if (t.dataset.hex) {
        const hex = toHex(t.value.startsWith("#") ? t.value : "#" + t.value);
        t.classList.toggle("is-invalid", !hex);
        if (!hex) return;
        draft.palette[t.dataset.hex] = hex;
        panel.querySelector(`[data-key="${t.dataset.hex}"]`).value = hex;
        onPaletteChange();
      }
      saveDraft();
    });

    panel.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "from") {
        const { palette, dark } = readTheme(t.value);
        Object.assign(draft, { from: t.value, palette, dark });
        renderForm();
        onPaletteChange();
      } else if (t.name === "dark") {
        draft.dark = t.checked;
        applyPreview();
      } else if (t.dataset.hex) {
        t.value = draft.palette[t.dataset.hex];   // snap back a half-typed hex
        t.classList.remove("is-invalid");
      }
      saveDraft();
    });

    panel.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "close") close();
      else if (action === "collapse") setCollapsed(!panel.classList.contains("is-collapsed"));
      else if (action === "download") download();
      else if (action === "copy-css") copy(buildCss(), "CSS copied.");
      else if (action === "share") {
        const url = new URL(window.location.href);
        url.searchParams.delete("theme");
        url.searchParams.set(URL_PARAM, encodeDraft(draft));
        copy(url.toString(), "Preview link copied. Anyone with it sees this draft.");
      }
    });
  }

  function setCollapsed(collapsed) {
    panel.classList.toggle("is-collapsed", collapsed);
    const btn = panel.querySelector('[data-action="collapse"]');
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.innerHTML = collapsed ? "&plus;" : "&minus;";
    btn.title = collapsed ? "Expand" : "Minimize";
  }

  function onPaletteChange() {
    applyPreview();
    renderChecks();
  }

  function renderForm() {
    panel.querySelector('input[name="name"]').value = draft.name;
    panel.querySelector('select[name="from"]').value = draft.from;
    panel.querySelector('input[name="dark"]').checked = draft.dark;
    KEYS.forEach((k) => {
      panel.querySelector(`[data-key="${k}"]`).value = draft.palette[k];
      const hex = panel.querySelector(`[data-hex="${k}"]`);
      hex.value = draft.palette[k];
      hex.classList.remove("is-invalid");
    });
    renderOutputs();
    renderChecks();
  }

  function renderOutputs() {
    const id = slugify(draft.name);
    const steps = setupSteps();
    panel.querySelector('[data-out="file"]').textContent = `css/themes/${id}.css`;
    panel.querySelector('[data-out="id-warning"]').textContent =
      existingIds().includes(id) ? ` — “${themeName(id === "vanilla-bean" ? "" : id)}” already uses this name` : "";
    steps.forEach((s, i) => { panel.querySelector(`[data-out="step-${i}"]`).textContent = s; });
  }

  function renderChecks() {
    const list = panel.querySelector('[data-out="checks"]');
    list.textContent = "";
    CONTRAST_CHECKS.forEach(([fg, bg, label]) => {
      const ratio = contrast(draft.palette[fg], draft.palette[bg]);
      const ok = ratio >= 4.5;
      const li = document.createElement("li");
      li.className = ok ? "is-ok" : "is-low";
      li.textContent = `${label}: ${ratio.toFixed(1)} ${ok ? "✓" : "— hard to read"}`;
      list.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------------
     Open / close
  --------------------------------------------------------------------- */
  function open(fromDraft) {
    if (!panel) buildPanel();
    draft = fromDraft || draft || loadSavedDraft() || newDraftFrom(root.getAttribute("data-theme") || "");
    saveDraft();
    renderForm();
    applyPreview();
    setCollapsed(false);
    panel.hidden = false;
  }

  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    clearPreview();
    setUrlDraft(null);
  }

  // Adds "Create theme" to the bottom of the theme switcher panel.
  function addSwitcherEntry() {
    const switcherPanel = document.querySelector(".theme-switcher__panel");
    if (!switcherPanel) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-switcher__create";
    btn.textContent = "+ Create theme";
    btn.addEventListener("click", () => {
      switcherPanel.hidden = true;
      document.querySelector(".theme-switcher__toggle")?.setAttribute("aria-expanded", "false");
      open();
    });
    switcherPanel.appendChild(btn);

    // Picking a saved theme ends the preview; the draft is kept for later.
    switcherPanel.addEventListener("click", (e) => {
      if (e.target.closest(".theme-switcher__option")) close();
    });
  }

  function init() {
    addSwitcherEntry();
    const shared = new URLSearchParams(window.location.search).get(URL_PARAM);
    if (shared) {
      const d = decodeDraft(shared);
      if (d) open(d);
      else setUrlDraft(null);
    }
  }

  // Runs after theme-switcher.js has built its panel (both wait for DOMContentLoaded).
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

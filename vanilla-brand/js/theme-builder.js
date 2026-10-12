// Theme builder — design a new theme live on the page, then download it as
// a ready-to-add file for css/themes/. Opens from "Create theme" in the
// theme switcher. The draft is kept in localStorage, and "Copy preview link"
// shares it with anyone as ?draft=... (nothing is saved to the server).
//
// Two levels, matching css/tokens/colors.css:
//   - Base colors: the 11 --palette-* values every theme sets.
//   - Page parts:  per-part tokens (--header-bg, --card-price, ...). They
//                  follow the base colors until you change one; only the
//                  ones you change are written to the file, as overrides.
//
// To remove it, delete this script, its CSS file and their tags in index.html.

(function () {
  const STORAGE_KEY = "vanilla-theme-draft";
  const URL_PARAM = "draft";
  const root = document.documentElement;
  const themes = window.VANILLA_THEMES || [];

  // Mirrors css/themes/_template.css: [key, label, comment in the file].
  const PALETTE_GROUPS = [
    {
      title: "Light areas",
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
      fields: [
        ["accent", "Accent", "prices, eyebrows, active states"],
        ["accent-soft", "Soft accent", "softer accent: headings on deep areas, hovers"]
      ]
    },
    {
      title: "Deep areas",
      fields: [
        ["deep", "Background", "background of the bold sections"],
        ["deep-alt", "Inner panels", "panels inside deep sections"],
        ["on-deep", "Text", "text on deep sections, accent fills and photos"],
        ["line-deep", "Borders", "borders inside deep sections"]
      ]
    }
  ];
  const PALETTE_KEYS = PALETTE_GROUPS.flatMap((g) => g.fields.map((f) => f[0]));

  // Page parts. Each field is [label, tokens it sets]. "target" is scrolled
  // into view when the section is opened.
  const PARTS = [
    { title: "Header", target: ".site-header", fields: [
      ["Background", ["--header-bg"]],
      ["Text", ["--header-text"]],
      ["Outline", ["--header-border"]]
    ] },
    { title: "Hero", target: "#hero", fields: [
      ["Title text", ["--hero-caption-text"]],
      ["Title on hover", ["--hero-caption-hover"]],
      ["Eyebrow", ["--hero-eyebrow"]]
    ] },
    { title: "Main", target: "#categories .section-heading", fields: [
      ["Text", ["--page-text"]],
      ["Subtitle accent", ["--page-eyebrow"]]
    ] },
    { title: "Categories", target: ".category-toggle", fields: [
      ["Text", ["--category-label"]],
      ["Logo background", ["--category-icon-bg"]],
      ["Logo background (selected)", ["--category-active-icon-bg"]],
      ["Selected background", ["--category-active-bg"]],
      ["Selected outline", ["--category-active-border"]]
    ] },
    { title: "Product cards", target: ".products__grid", fields: [
      ["Image background", ["--card-image-from", "--card-image-to"]],
      ["Card background", ["--card-bg"]],
      ["Card outline", ["--card-border"]],
      ["Text", ["--card-text"]],
      ["Subtitle text", ["--card-text-muted"]],
      ["Price", ["--card-price"]]
    ] },
    { title: "Info", target: "#info", fields: [
      ["Background", ["--info-bg"]],
      ["Title", ["--info-heading"]],
      ["Text", ["--info-text"]],
      ["Carousel title", ["--info-slide-title"]]
    ] },
    { title: "Footer", target: ".site-footer", fields: [
      ["Text", ["--footer-text"]],
      ["Sub text", ["--footer-subtext"]],
      ["Accent", ["--footer-heading", "--footer-link-hover"]]
    ] }
  ];
  const PART_FIELDS = PARTS.flatMap((part, p) => part.fields.map(([label, tokens], f) => ({ id: `${p}-${f}`, part, label, tokens })));
  const PART_TOKENS = PART_FIELDS.flatMap((f) => f.tokens);

  // Text/background pairs worth checking for readability (WCAG AA = 4.5).
  const CONTRAST_CHECKS = [
    ["--header-text", "--header-bg", "Header text"],
    ["--page-text", "--page-bg", "Main text"],
    ["--category-label", "--page-bg", "Category text"],
    ["--card-text", "--card-bg", "Card text"],
    ["--card-text-muted", "--card-bg", "Card subtitle"],
    ["--card-price", "--card-bg", "Card price"],
    ["--info-text", "--info-bg", "Info text"],
    ["--footer-text", "--footer-bg", "Footer text"],
    ["--footer-subtext", "--footer-bg", "Footer sub text"]
  ];

  let draft = null;   // { name, from, dark, palette: {key: hex}, overrides: {token: hex} }
  let panel = null;
  let probe = null;   // hidden element that inherits the live tokens from <html>

  /* ---------------------------------------------------------------------
     Color helpers
  --------------------------------------------------------------------- */
  const HEX = /^#[0-9a-f]{6}$/;

  // "#abc", "#aabbcc" -> "#aabbcc" (null otherwise).
  function normalizeHex(value) {
    let v = String(value || "").trim().toLowerCase();
    if (!v.startsWith("#")) v = "#" + v;
    if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + v.slice(1).split("").map((c) => c + c).join("");
    return HEX.test(v) ? v : null;
  }

  // A computed CSS color ("rgb(...)", "rgba(...)", "color(srgb ...)") -> "#rrggbb".
  function computedToHex(css) {
    const nums = (css.match(/[\d.]+/g) || []).map(Number);
    let rgb;
    if (css.startsWith("rgb")) rgb = nums.slice(0, 3);
    else if (css.startsWith("color(srgb")) rgb = nums.slice(0, 3).map((n) => n * 255);
    else return null;
    if (rgb.length < 3) return null;
    return "#" + rgb.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("");
  }

  // Resolves any color token on an element to "#rrggbb".
  function tokenHex(el, token) {
    el.style.color = `var(${token})`;
    return computedToHex(getComputedStyle(el).color) || "#000000";
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
  function makeProbe(theme, inline) {
    const el = document.createElement("div");
    el.setAttribute("data-theme", theme);
    el.style.display = "none";
    Object.entries(inline || {}).forEach(([k, v]) => el.style.setProperty(k, v));
    document.body.appendChild(el);
    return el;
  }

  // Returns a theme's palette plus any part tokens its file overrides.
  function readTheme(id) {
    const themed = makeProbe(id || "vanilla-bean");
    const cs = getComputedStyle(themed);
    const palette = {};
    PALETTE_KEYS.forEach((k) => { palette[k] = tokenHex(themed, `--palette-${k}`); });
    const dark = cs.colorScheme.trim() === "dark";

    // Same palette on an element no theme file matches: anything that
    // differs from it is an override in the theme's file.
    const plain = makeProbe("__builder-plain__", Object.fromEntries(PALETTE_KEYS.map((k) => [`--palette-${k}`, palette[k]])));
    const overrides = {};
    PART_TOKENS.forEach((t) => {
      const v = tokenHex(themed, t);
      if (v !== tokenHex(plain, t)) overrides[t] = v;
    });
    themed.remove();
    plain.remove();
    return { palette, dark, overrides };
  }

  function themeName(id) {
    const t = themes.find((x) => (x.id || "vanilla-bean") === id);
    return t ? t.name : id;
  }

  function slugify(name) {
    return String(name)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "my-theme";
  }

  /* ---------------------------------------------------------------------
     Draft: load / save / share
  --------------------------------------------------------------------- */
  // Accepts untrusted input (localStorage or a shared link) and returns a
  // clean draft, or null if it doesn't look like one.
  function sanitize(raw) {
    if (!raw || typeof raw !== "object" || !raw.palette) return null;
    const palette = {};
    for (const k of PALETTE_KEYS) {
      const hex = normalizeHex(raw.palette[k]);
      if (!hex) return null;
      palette[k] = hex;
    }
    const overrides = {};
    Object.entries(raw.overrides || {}).forEach(([t, v]) => {
      const hex = normalizeHex(v);
      if (PART_TOKENS.includes(t) && hex) overrides[t] = hex;
    });
    return {
      name: String(raw.name || "My Theme").slice(0, 40),
      from: typeof raw.from === "string" && themes.some((t) => t.id === raw.from) ? raw.from : "",
      dark: Boolean(raw.dark),
      palette,
      overrides
    };
  }

  function encodeDraft(d) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(d))))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    return { name: "My Theme", from: id, ...readTheme(id) };
  }

  function setUrlDraft(value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(URL_PARAM, value);
    else url.searchParams.delete(URL_PARAM);
    history.replaceState(null, "", url);
  }

  /* ---------------------------------------------------------------------
     Live preview: inline custom properties on <html> beat any theme file.
  --------------------------------------------------------------------- */
  function applyPreview() {
    PALETTE_KEYS.forEach((k) => root.style.setProperty(`--palette-${k}`, draft.palette[k]));
    PART_TOKENS.forEach((t) => {
      if (draft.overrides[t]) root.style.setProperty(t, draft.overrides[t]);
      else root.style.removeProperty(t);
    });
    root.style.colorScheme = draft.dark ? "dark" : "light";
  }

  function clearPreview() {
    PALETTE_KEYS.forEach((k) => root.style.removeProperty(`--palette-${k}`));
    PART_TOKENS.forEach((t) => root.style.removeProperty(t));
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
    const line = (prop, value, comment) => {
      const decl = `  ${prop}: ${value};`;
      return comment ? `${decl.padEnd(37)}/* ${comment} */` : decl;
    };

    const blocks = PALETTE_GROUPS.map((g) =>
      g.fields.map(([k, , c]) => line(`--palette-${k}`, draft.palette[k], c)).join("\n"));

    PARTS.forEach((part) => {
      const lines = part.fields.flatMap(([, tokens]) => tokens)
        .filter((t) => draft.overrides[t])
        .map((t) => line(t, draft.overrides[t]));
      if (lines.length) blocks.push(`  /* ---- ${part.title} ---- */\n${lines.join("\n")}`);
    });

    return `/* ==========================================================================
   THEME — "${safeName()}"
   Made with the theme builder on ${date}.
   ========================================================================== */
[data-theme="${id}"] {
${draft.dark ? "  color-scheme: dark;\n\n" : ""}${blocks.join("\n\n")}
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
  // One color row: swatch picker, label, hex box and (for parts) a reset.
  function colorRow(label, attrs, withReset) {
    const row = document.createElement("div");
    row.className = "theme-builder__color";
    Object.entries(attrs).forEach(([k, v]) => { row.dataset[k] = v; });
    row.innerHTML = `
      <input type="color" class="theme-builder__swatch">
      <span class="theme-builder__color-label"></span>
      <input type="text" class="theme-builder__hex" maxlength="7" spellcheck="false" autocomplete="off">
      ${withReset ? '<button type="button" class="theme-builder__reset" data-action="reset" title="Back to base color" aria-label="Back to base color">&#8634;</button>' : ""}
    `;
    row.querySelector(".theme-builder__color-label").textContent = label;
    row.querySelector(".theme-builder__swatch").setAttribute("aria-label", label);
    row.querySelector(".theme-builder__hex").setAttribute("aria-label", `${label} hex value`);
    return row;
  }

  function section(title, hint, open) {
    const details = document.createElement("details");
    details.className = "theme-builder__section";
    details.open = Boolean(open);
    const summary = document.createElement("summary");
    const strong = document.createElement("span");
    strong.textContent = title;
    summary.appendChild(strong);
    const small = document.createElement("small");
    small.className = "theme-builder__section-hint";
    small.textContent = hint;
    summary.appendChild(small);
    details.appendChild(summary);
    return details;
  }

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

        <div data-out="sections"></div>

        <details class="theme-builder__section">
          <summary><span>Readability</span><small class="theme-builder__section-hint" data-out="checks-summary"></small></summary>
          <ul class="theme-builder__checks" data-out="checks"></ul>
        </details>

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

    const select = panel.querySelector('select[name="from"]');
    themes.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    });

    const wrap = panel.querySelector('[data-out="sections"]');

    // Base colors
    const base = section("Base colors", "sets everything below", false);
    PALETTE_GROUPS.forEach((g) => {
      const legend = document.createElement("p");
      legend.className = "theme-builder__legend";
      legend.textContent = g.title;
      base.appendChild(legend);
      g.fields.forEach(([key, label]) => base.appendChild(colorRow(label, { palette: key }, false)));
    });
    wrap.appendChild(base);

    // Page parts
    PARTS.forEach((part, p) => {
      const sec = section(part.title, "", p === 0);
      sec.dataset.part = String(p);
      PART_FIELDS.filter((f) => f.part === part)
        .forEach((f) => sec.appendChild(colorRow(f.label, { field: f.id }, true)));
      sec.addEventListener("toggle", () => {
        if (!sec.open) return;
        const target = document.querySelector(part.target);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      wrap.appendChild(sec);
    });

    probe = document.createElement("div");
    probe.style.display = "none";
    document.body.appendChild(probe);
    document.body.appendChild(panel);
    wirePanel();
  }

  function fieldById(id) {
    return PART_FIELDS.find((f) => f.id === id);
  }

  // Sets a row's color from the swatch or the hex box.
  function setRowColor(row, hex) {
    if (row.dataset.palette) {
      draft.palette[row.dataset.palette] = hex;
    } else {
      fieldById(row.dataset.field).tokens.forEach((t) => { draft.overrides[t] = hex; });
    }
    applyPreview();
    refreshColors(row);
    renderChecks();
  }

  function wirePanel() {
    panel.addEventListener("input", (e) => {
      const t = e.target;
      const row = t.closest(".theme-builder__color");
      if (t.name === "name") {
        draft.name = t.value;
        renderOutputs();
      } else if (row && t.classList.contains("theme-builder__swatch")) {
        row.querySelector(".theme-builder__hex").value = t.value;
        setRowColor(row, t.value.toLowerCase());
      } else if (row && t.classList.contains("theme-builder__hex")) {
        const hex = normalizeHex(t.value);
        t.classList.toggle("is-invalid", !hex);
        if (!hex) return;
        row.querySelector(".theme-builder__swatch").value = hex;
        setRowColor(row, hex);
      }
      saveDraft();
    });

    panel.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "from") {
        Object.assign(draft, { from: t.value }, readTheme(t.value));
        applyPreview();
        renderForm();
      } else if (t.name === "dark") {
        draft.dark = t.checked;
        applyPreview();
      } else if (t.classList.contains("theme-builder__hex")) {
        refreshColors();   // snap back a half-typed hex
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
      else if (action === "reset") {
        fieldById(btn.closest(".theme-builder__color").dataset.field).tokens
          .forEach((t) => { delete draft.overrides[t]; });
        applyPreview();
        refreshColors();
        renderChecks();
        saveDraft();
      } else if (action === "share") {
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

  // Re-reads every row's color from the live page, so part rows that still
  // follow the base colors update as those change. "skip" is the row being
  // edited, left alone so typing isn't interrupted.
  function refreshColors(skip) {
    panel.querySelectorAll(".theme-builder__color").forEach((row) => {
      let hex;
      let overridden = false;
      if (row.dataset.palette) {
        hex = draft.palette[row.dataset.palette];
      } else {
        const f = fieldById(row.dataset.field);
        overridden = f.tokens.some((t) => draft.overrides[t]);
        hex = draft.overrides[f.tokens[0]] || tokenHex(probe, f.tokens[0]);
      }
      row.classList.toggle("is-overridden", overridden);
      if (row === skip) return;
      row.querySelector(".theme-builder__swatch").value = hex;
      const box = row.querySelector(".theme-builder__hex");
      box.value = hex;
      box.classList.remove("is-invalid");
    });

    // "2 changed" next to each part's title
    panel.querySelectorAll(".theme-builder__section[data-part]").forEach((sec) => {
      const n = sec.querySelectorAll(".theme-builder__color.is-overridden").length;
      sec.querySelector(".theme-builder__section-hint").textContent = n ? `${n} changed` : "";
    });
  }

  function renderForm() {
    panel.querySelector('input[name="name"]').value = draft.name;
    panel.querySelector('select[name="from"]').value = draft.from;
    panel.querySelector('input[name="dark"]').checked = draft.dark;
    refreshColors();
    renderOutputs();
    renderChecks();
  }

  function renderOutputs() {
    const id = slugify(draft.name);
    panel.querySelector('[data-out="file"]').textContent = `css/themes/${id}.css`;
    const taken = themes.some((t) => (t.id || "vanilla-bean") === id);
    panel.querySelector('[data-out="id-warning"]').textContent =
      taken ? ` — “${themeName(id)}” already uses this name` : "";
    setupSteps().forEach((s, i) => { panel.querySelector(`[data-out="step-${i}"]`).textContent = s; });
  }

  function renderChecks() {
    const list = panel.querySelector('[data-out="checks"]');
    list.textContent = "";
    let low = 0;
    CONTRAST_CHECKS.forEach(([fg, bg, label]) => {
      const ratio = contrast(tokenHex(probe, fg), tokenHex(probe, bg));
      const ok = ratio >= 4.5;
      if (!ok) low++;
      const li = document.createElement("li");
      li.className = ok ? "is-ok" : "is-low";
      li.textContent = `${label}: ${ratio.toFixed(1)} ${ok ? "✓" : "— hard to read"}`;
      list.appendChild(li);
    });
    const summary = panel.querySelector('[data-out="checks-summary"]');
    summary.textContent = low ? `${low} hard to read` : "all good";
    summary.classList.toggle("is-low", low > 0);
  }

  /* ---------------------------------------------------------------------
     Open / close
  --------------------------------------------------------------------- */
  function open(fromDraft) {
    if (!panel) buildPanel();
    draft = fromDraft || draft || loadSavedDraft() || newDraftFrom(root.getAttribute("data-theme") || "");
    saveDraft();
    applyPreview();
    renderForm();
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

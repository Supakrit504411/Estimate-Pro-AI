(function () {
  const STORAGE_KEY = "pea_theme_v1";
  const MODES = ["dark", "light", "auto"];

  function normalizeMode(value) {
    return MODES.includes(value) ? value : "light";
  }

  function resolveEffective(preference) {
    if (preference === "light" || preference === "dark") return preference;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function getPreference() {
    try {
      return normalizeMode(localStorage.getItem(STORAGE_KEY) || "light");
    } catch (error) {
      return "light";
    }
  }

  function getEffective() {
    return resolveEffective(getPreference());
  }

  function updateSwitchUi() {
    const pref = getPreference();
    document.querySelectorAll(".theme-switch [data-theme-pref]").forEach(button => {
      const active = button.dataset.themePref === pref;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function updateThemeColor(effective) {
    const color = effective === "light" ? "#f5f1e8" : "#131217";
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  function applyTheme(preference, options = {}) {
    const pref = normalizeMode(preference);
    const effective = resolveEffective(pref);
    const root = document.documentElement;

    root.setAttribute("data-theme-pref", pref);
    root.setAttribute("data-theme", effective);
    root.style.colorScheme = effective;
    updateThemeColor(effective);

    if (!options.silent) {
      try {
        localStorage.setItem(STORAGE_KEY, pref);
      } catch (error) {
        console.warn("theme storage failed", error);
      }
    }

    updateSwitchUi();

    if (!options.skipEvent) {
      window.dispatchEvent(new CustomEvent("pea-theme-change", {
        detail: { preference: pref, theme: effective }
      }));
    }

    return effective;
  }

  function bindThemeSwitches(root) {
    (root || document).querySelectorAll(".theme-switch [data-theme-pref]").forEach(button => {
      if (button.dataset.themeBound === "1") return;
      button.dataset.themeBound = "1";
      button.addEventListener("click", () => {
        applyTheme(button.dataset.themePref);
      });
    });
  }

  function init(options = {}) {
    const pref = options.preference || getPreference();
    applyTheme(pref, { silent: false, skipEvent: true });
    bindThemeSwitches(document);

    if (!window.__peaThemeMediaBound) {
      window.__peaThemeMediaBound = true;
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
        if (getPreference() === "auto") {
          applyTheme("auto", { skipEvent: false });
        }
      });
    }

    window.dispatchEvent(new CustomEvent("pea-theme-change", {
      detail: { preference: pref, theme: getEffective() }
    }));
  }

  window.PEATheme = {
    STORAGE_KEY,
    MODES,
    getPreference,
    getEffective,
    applyTheme,
    bindThemeSwitches,
    init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})();

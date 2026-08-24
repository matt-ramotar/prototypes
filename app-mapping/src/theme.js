// Theme resolution: an explicit choice wins, otherwise follow the OS.
// Kept framework-free so the pre-paint script in index.html can call apply().

const KEY = "am.theme";
export const MODES = ["system", "light", "dark"];

export function storedMode() {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v) ? v : "system";
  } catch { return "system"; }
}

export function systemPrefersDark() {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolve(mode) {
  return mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
}

export function apply(mode) {
  const theme = resolve(mode);
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.setAttribute("data-theme", theme);
  return theme;
}

export function setMode(mode) {
  try { localStorage.setItem(KEY, mode); } catch { /* private mode */ }
  return apply(mode);
}

/** Cycles system → light → dark → system. */
export function nextMode(mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}

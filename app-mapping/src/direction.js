// Three design directions for the landing surface, live side by side so the
// choice is made against the real data instead of a mockup.

export const DIRECTIONS = [
  {
    id: "control",
    label: "Control Room",
    blurb: "The question is the interface. State the Given, pick the When, jump to the answer.",
  },
  {
    id: "evidence",
    label: "Evidence Wall",
    blurb: "The captures are the interface. Every journey's freshest walk, visible at once.",
  },
  {
    id: "ledger",
    label: "Ledger",
    blurb: "The record is the interface. Build by build, what the map gained, lost and changed.",
  },
];

const KEY = "am.direction";
const IDS = DIRECTIONS.map((d) => d.id);

export function storedDirection(search = window.location.search) {
  const fromUrl = new URLSearchParams(search).get("dir");
  if (IDS.includes(fromUrl)) return fromUrl;
  try {
    const v = localStorage.getItem(KEY);
    if (IDS.includes(v)) return v;
  } catch { /* private mode */ }
  return "control";
}

export function setDirection(id) {
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
  const url = new URL(window.location.href);
  url.searchParams.set("dir", id);
  window.history.replaceState(null, "", url.pathname + url.search);
  return id;
}

// Hand-rolled router. Vite's default SPA fallback serves index.html for deep
// paths, so history routing needs no dependency.

const LIST = {screens: "screens", journeys: "journeys", lanes: "lanes", builds: "builds",
  reports: "reports", review: "review"};
const ENTITY = {screens: "screen", journeys: "journey", lanes: "lane", builds: "build",
  reports: "report", review: "proposal"};

export const PAGES = ["atlas", "map", "threads", "screens", "screen", "journeys", "journey",
  "lanes", "lane", "builds", "build", "reports", "report", "review", "proposal", "ask"];

export function matchRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return {page: "atlas", params: {}, note: null};
  const [head, rest, ...extra] = parts;
  if (extra.length === 0) {
    if (head === "map" && !rest) return {page: "map", params: {}, note: null};
    if (head === "threads" && !rest) return {page: "threads", params: {}, note: null};
    if (head === "ask" && !rest) return {page: "ask", params: {}, note: null};
    if (head in LIST && !rest) return {page: LIST[head], params: {}, note: null};
    if (head in ENTITY && rest) {
      const decoded = decodeURIComponent(rest);
      const params = ENTITY[head] === "screen" ? {key: decoded} : {id: decoded};
      return {page: ENTITY[head], params, note: null};
    }
  }
  return {page: "atlas", params: {}, note: `Unknown path "${pathname}" — showing the Atlas`};
}

export function pathFor(page, param) {
  if (page === "atlas") return "/";
  if (page === "map" || page === "ask" || page === "threads") return `/${page}`;
  if (page in LIST) return `/${page}`;
  const heads = {screen: "screens", journey: "journeys", lane: "lanes", build: "builds",
    report: "reports", proposal: "review"};
  if (page in heads) return `/${heads[page]}/${encodeURIComponent(param)}`;
  return "/";
}

export function legacyRedirect(pathname, search) {
  if (pathname !== "/") return null;
  const p = new URLSearchParams(search);
  if (p.get("journey") != null || p.get("container") != null) return `/map${search}`;
  return null;
}

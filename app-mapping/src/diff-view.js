// Builds the B-side query for a diff comparison from the mounted (A-side) query.
// fixture pragmatism — one locale per market in the fixture world; dies at corpus swap
export const MARKET_LOCALE = {US: "en-US", DE: "de-DE"};

// Copies query, moves the pivoted field to its counterpart value, and (for a market
// pivot with a known counterpart) carries the locale along with it. An unknown market
// counterpart leaves locale untouched — the mismatch then resolves to no observation
// and the surface's refusal state, which is the honest failure. Always nulls pivot and
// counterpart. Does not canonicalize; the caller does.
export function counterpartQuery(query) {
  const q = {...query};
  q[query.pivot] = query.counterpart;
  if (query.pivot === "market" && MARKET_LOCALE[query.counterpart] !== undefined) {
    q.locale = MARKET_LOCALE[query.counterpart];
  }
  q.pivot = null;
  q.counterpart = null;
  return q;
}

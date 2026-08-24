import {
  BUILDS, FACETS, FRAME_LINE, JOURNEYS, LANES, MAP_VERSION, OBSERVATIONS,
  SCREENS, EDGES, THIN_OBSERVATION_FLOOR,
} from "./fixtures.js";

const PARAM_ORDER = ["journey", "container", "platform", "cohort", "locale", "market",
  "build", "pivot", "counterpart", "view", "screen"];
const PIVOTABLE = ["cohort", "locale", "market", "build"];
const VIEWS = ["report", "reel-a", "reel-b", "captures"];

export function parseQuery(search) {
  const p = new URLSearchParams(search);
  const q = {};
  for (const k of PARAM_ORDER) q[k] = p.get(k);
  return q;
}

export function serializeQuery(query) {
  const p = new URLSearchParams();
  for (const k of PARAM_ORDER) if (query[k] != null) p.set(k, query[k]);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function laneFor(query) {
  if (!query?.container || !query?.platform) return null;
  return LANES.find((l) =>
    l.container.toLowerCase() === query.container.toLowerCase() &&
    l.platform.toLowerCase() === query.platform.toLowerCase()) ?? null;
}

export function canonicalize(raw) {
  const query = {...raw};
  const notes = [];
  const drop = (field, note) => { query[field] = null; notes.push(note); };

  if (query.journey && !JOURNEYS.some((j) => j.id === query.journey))
    drop("journey", `Unknown journey "${raw.journey}"`);
  if ((query.container || query.platform) && !laneFor(query)) {
    const laneDesc = `${raw.container || "(no container)"} · ${raw.platform || "(no platform)"}`;
    const note = `Unknown lane "${laneDesc}"`;
    if (query.container) drop("container", note);
    if (query.platform) drop("platform", note);
  }
  for (const f of ["cohort", "locale", "market"])
    if (query[f] && !FACETS[f].includes(query[f])) drop(f, `Unknown ${f} "${raw[f]}"`);
  if (query.build && !BUILDS.includes(query.build))
    drop("build", `Unknown build "${raw.build}" — showing freshest observation`);
  if (query.view && !VIEWS.includes(query.view)) query.view = "report";
  if (query.screen && !SCREENS[query.screen])
    drop("screen", `Unknown screen key`);
  if (query.pivot) {
    const ok = PIVOTABLE.includes(query.pivot) && query.counterpart != null &&
      query.counterpart !== query[query.pivot];
    if (!ok) { drop("pivot", "Invalid pivot"); query.counterpart = null; }
  }
  return {query, notes};
}

function givenMatches(ob, query, lane) {
  return ob.lane === lane.id && ob.journey === query.journey &&
    ob.cohort === query.cohort && ob.locale === query.locale && ob.market === query.market;
}

function toAnswer(ob, lane, now) {
  const steps = ob.walk.map((w) => ({
    stack: w.stack.map((k) => SCREENS[k]),
    baseScreen: SCREENS[w.stack.at(-1)],
    variants: w.variants,
    occluded: w.occluded,
  }));
  const nodeKeys = new Set(ob.walk.flatMap((w) => w.stack));
  const nodes = [...nodeKeys].map((k) => SCREENS[k]);
  const offSpine = [];
  ob.walk.forEach((w, i) => {
    for (const e of EDGES) {
      if (!e.traversable && w.stack.includes(e.from) && !nodeKeys.has(e.to))
        offSpine.push({key: e.to, afterIndex: i, role: e.role});
    }
  });
  const ageDays = Math.floor((now - new Date(ob.observedAt)) / 86400000);
  return {
    given: {laneId: ob.lane, container: lane.container, platform: lane.platform,
      cohort: ob.cohort, locale: ob.locale, market: ob.market, build: ob.build},
    journey: JOURNEYS.find((j) => j.id === ob.journey),
    steps,
    counts: {
      screens: nodes.filter((n) => n.kind === "SCREEN").length,
      overlays: nodes.filter((n) => n.kind === "OVERLAY").length,
      permissionPrompts: nodes.filter((n) => n.phase === "Permissions" && n.kind === "SCREEN").length,
    },
    offSpine,
    thin: ob.obsCount < THIN_OBSERVATION_FLOOR,
    obsCount: ob.obsCount,
    observedAt: ob.observedAt,
    ageDays,
    runId: ob.runId,
    mapVersion: MAP_VERSION,
    frame: FRAME_LINE,
  };
}

export function resolveAnswer(query, now) {
  const lane = laneFor(query);
  if (!query.journey || !lane || !query.cohort || !query.locale || !query.market)
    return {kind: "atlas"};

  const matches = OBSERVATIONS.filter((ob) => givenMatches(ob, query, lane));
  if (matches.length > 0) {
    const freshest = [...matches].sort((a, b) => BUILDS.indexOf(b.build) - BUILDS.indexOf(a.build))[0];
    if (query.build == null) return {kind: "answer", answer: toAnswer(freshest, lane, now)};
    const exact = matches.find((ob) => ob.build === query.build);
    if (exact) return {kind: "answer", answer: toAnswer(exact, lane, now)};
    return {kind: "stale-candidate", requestedBuild: query.build, candidate: toAnswer(freshest, lane, now)};
  }

  const laneRows = OBSERVATIONS.filter((ob) => ob.lane === lane.id);
  const laneJourneyRows = laneRows.filter((ob) => ob.journey === query.journey);
  const reason = laneRows.length === 0 ? "lane-not-in-crawl-set"
    : laneJourneyRows.length === 0 ? "journey-not-observed-in-lane"
    : "context-not-observed-in-lane";
  let nearest = null, best = -1;
  for (const ob of OBSERVATIONS) {
    if (ob.journey !== query.journey) continue;
    const obLane = LANES.find((l) => l.id === ob.lane);
    const score = (ob.cohort === query.cohort) + (ob.locale === query.locale) +
      (ob.market === query.market) + (obLane.container === lane.container) +
      (obLane.platform === lane.platform);
    if (score > best) {
      best = score;
      nearest = {journey: ob.journey, container: obLane.container.toLowerCase(),
        platform: obLane.platform.toLowerCase(), cohort: ob.cohort, locale: ob.locale,
        market: ob.market, build: ob.build, pivot: null, counterpart: null, view: null, screen: null};
    }
  }
  return {kind: "not-walked", reason, nearest};
}

// Derived views for the landing surfaces. Pure functions over the fixture shape
// so each design direction renders the same numbers and none of them invent data.

import {BUILDS, JOURNEYS, LANES, OBSERVATIONS, SCREENS} from "./fixtures.js";
import {atlasCells} from "./atlas-view.js";
import {resolveAnswer} from "./query.js";
import {computeDiff} from "./diff.js";

export const DEFAULT_CONTEXT = {cohort: "new", locale: "en-US", market: "US", build: BUILDS.at(-1)};

const laneById = (id) => LANES.find((l) => l.id === id);
const journeyById = (id) => JOURNEYS.find((j) => j.id === id);

/** Headline coverage arithmetic for a Given context. */
export function coverage(context, now) {
  const cells = atlasCells(context, now);
  const observed = cells.filter((c) => c.state !== "none");
  const byState = {fresh: 0, stale: 0, thin: 0, none: 0};
  for (const c of cells) byState[c.state] += 1;
  const screens = observed.reduce((n, c) => n + c.screenCount, 0);
  return {
    cells,
    total: cells.length,
    observed: observed.length,
    byState,
    screens,
    percent: cells.length === 0 ? 0 : Math.round((observed.length / cells.length) * 100),
  };
}

/**
 * The three cells worth looking at first: the freshest evidence, the observed
 * cell that has decayed furthest, and the one resting on the least evidence.
 * Returns null entries when nothing in the context qualifies.
 */
export function signals(context, now) {
  const observed = coverage(context, now).cells.filter((c) => c.state !== "none");
  const decorate = (c) => (c ? {
    ...c,
    journey: journeyById(c.journeyId),
    lane: laneById(c.laneId),
  } : null);
  const byAge = [...observed].sort((a, b) => a.ageDays - b.ageDays);
  const byObs = [...observed].sort((a, b) => a.obsCount - b.obsCount);
  return {
    freshest: decorate(byAge[0]),
    stalest: decorate(byAge.at(-1)),
    thinnest: decorate(byObs[0]),
  };
}

/** Per-journey freshest walk for a context, with the lane it came from. */
export function journeyStrips(context, now) {
  return JOURNEYS.map((journey) => {
    const candidates = OBSERVATIONS.filter((o) =>
      o.journey === journey.id && o.cohort === context.cohort &&
      o.locale === context.locale && o.market === context.market);
    if (candidates.length === 0) return {journey, lane: null, answer: null, ageDays: null};
    const best = [...candidates].sort((a, b) =>
      BUILDS.indexOf(b.build) - BUILDS.indexOf(a.build) ||
      new Date(b.observedAt) - new Date(a.observedAt))[0];
    const lane = laneById(best.lane);
    const resolution = resolveAnswer({
      journey: journey.id,
      container: lane.container.toLowerCase(),
      platform: lane.platform.toLowerCase(),
      cohort: best.cohort, locale: best.locale, market: best.market, build: best.build,
    }, now);
    return {
      journey,
      lane,
      answer: resolution.kind === "answer" ? resolution.answer : null,
      ageDays: Math.floor((now - new Date(best.observedAt)) / 86400000),
      state: best.build === context.build ? "fresh" : "stale",
    };
  });
}

/** Every Given observed on both builds, so a pair can be diffed honestly. */
function sharedGivens(build, prevBuild) {
  const key = (o) => `${o.lane}|${o.journey}|${o.cohort}|${o.locale}|${o.market}`;
  const prev = new Map(OBSERVATIONS.filter((o) => o.build === prevBuild).map((o) => [key(o), o]));
  return OBSERVATIONS.filter((o) => o.build === build && prev.has(key(o)))
    .map((o) => ({current: o}));
}

/**
 * Build-over-build record. `comparable` is the number of Givens observed on both
 * builds; the counts are unions over those pairs only, so a build whose Givens are
 * all new reports zero movement rather than a fabricated one.
 */
export function buildLedger(now) {
  return [...BUILDS].reverse().map((build) => {
    const idx = BUILDS.indexOf(build);
    const prevBuild = idx > 0 ? BUILDS[idx - 1] : null;
    const obs = OBSERVATIONS.filter((o) => o.build === build);
    const times = obs.map((o) => o.observedAt).sort();
    const pairs = prevBuild ? sharedGivens(build, prevBuild) : [];
    const added = new Set(), removed = new Set(), changed = new Set();

    for (const {current} of pairs) {
      const lane = laneById(current.lane);
      const base = {
        journey: current.journey,
        container: lane.container.toLowerCase(), platform: lane.platform.toLowerCase(),
        cohort: current.cohort, locale: current.locale, market: current.market,
      };
      const a = resolveAnswer({...base, build}, now);
      const b = resolveAnswer({...base, build: prevBuild}, now);
      if (a.kind !== "answer" || b.kind !== "answer") continue;
      const d = computeDiff(a.answer, b.answer);
      for (const e of d.onlyA) added.add(e.key);
      for (const e of d.onlyB) removed.add(e.key);
      for (const e of d.changed) changed.add(e.key);
    }

    return {
      build,
      prevBuild,
      observationCount: obs.reduce((n, o) => n + o.obsCount, 0),
      laneIds: [...new Set(obs.map((o) => o.lane))],
      journeyIds: [...new Set(obs.map((o) => o.journey))],
      screenCount: new Set(obs.flatMap((o) => o.walk.flatMap((w) => w.stack))).size,
      firstObservedAt: times[0] ?? null,
      lastObservedAt: times.at(-1) ?? null,
      ageDays: times.at(-1) ? Math.floor((now - new Date(times.at(-1))) / 86400000) : null,
      comparable: pairs.length,
      added: [...added].map((k) => SCREENS[k]),
      removed: [...removed].map((k) => SCREENS[k]),
      changed: [...changed].map((k) => SCREENS[k]),
    };
  });
}

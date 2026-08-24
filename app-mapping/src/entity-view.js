import {BUILDS, EDGES, JOURNEYS, LANES, OBSERVATIONS, SCREENS} from "./fixtures.js";
import {atlasCells} from "./atlas-view.js";

const ageDaysOf = (iso, now) => Math.floor((now - new Date(iso)) / 86400000);

function freshest(obs) {
  return [...obs].sort((a, b) => BUILDS.indexOf(b.build) - BUILDS.indexOf(a.build) ||
    new Date(b.observedAt) - new Date(a.observedAt))[0] ?? null;
}

export function screenEntity(key, now) {
  const screen = SCREENS[key];
  if (!screen) return null;
  const containing = OBSERVATIONS.filter((o) => o.walk.some((w) => w.stack.includes(key)));
  const sigs = new Map();
  const variantSet = new Set();
  for (const o of containing) {
    for (const w of o.walk) {
      if (!w.stack.includes(key)) continue;
      const sig = w.stack.join(" / ");
      if (!sigs.has(sig)) sigs.set(sig, {signature: sig, stack: w.stack.map((k) => SCREENS[k]), occluded: w.occluded});
      if (w.stack.at(-1) === key) w.variants.forEach((v) => variantSet.add(v));
    }
  }
  const f = freshest(containing);
  return {
    screen,
    journey: JOURNEYS.find((j) => j.id === screen.journeyId),
    kpis: {
      laneCount: new Set(containing.map((o) => o.lane)).size,
      compositionCount: sigs.size,
      variantSet: [...variantSet],
      latestBuild: f?.build ?? null,
      ageDays: f ? ageDaysOf(f.observedAt, now) : null,
    },
    appearsIn: containing.map((o) => ({lane: LANES.find((l) => l.id === o.lane), market: o.market,
      locale: o.locale, cohort: o.cohort, build: o.build, runId: o.runId})),
    compositions: [...sigs.values()],
    edgesIn: EDGES.filter((e) => e.to === key),
    edgesOut: EDGES.filter((e) => e.from === key),
    captures: containing.map((o) => ({build: o.build, laneId: o.lane, market: o.market,
      locale: o.locale, runId: o.runId, observedAt: o.observedAt})),
  };
}

export function journeyEntity(id, now) {
  const journey = JOURNEYS.find((j) => j.id === id);
  if (!journey) return null;
  const obs = OBSERVATIONS.filter((o) => o.journey === id);
  const screens = Object.values(SCREENS).filter((s) => s.journeyId === id);
  const defaultContext = {cohort: "new", locale: "en-US", market: "US", build: BUILDS.at(-1)};
  const f = freshest(obs);
  return {
    journey,
    kpis: {phaseCount: journey.phases.length, screenCount: screens.length,
      laneCount: new Set(obs.map((o) => o.lane)).size,
      latestBuild: f?.build ?? null, ageDays: f ? ageDaysOf(f.observedAt, now) : null},
    defaultContext,
    atlasRow: atlasCells(defaultContext, now).filter((c) => c.journeyId === id),
    phaseListing: journey.phases.map((phase) => ({phase, screens: screens.filter((s) => s.phase === phase)}))
      .filter((p) => p.screens.length > 0),
  };
}

export function laneEntity(id, now) {
  const lane = LANES.find((l) => l.id === id);
  if (!lane) return null;
  const obs = OBSERVATIONS.filter((o) => o.lane === id);
  const f = freshest(obs);
  const byJourney = JOURNEYS.map((journey) => {
    const jobs = obs.filter((o) => o.journey === journey.id);
    const jf = freshest(jobs);
    return jobs.length === 0 ? null : {journey, latestBuild: jf.build,
      ageDays: ageDaysOf(jf.observedAt, now), obsCount: jobs.reduce((n, o) => n + o.obsCount, 0)};
  }).filter(Boolean);
  return {
    lane,
    kpis: {journeyCount: byJourney.length,
      screenCount: new Set(obs.flatMap((o) => o.walk.flatMap((w) => w.stack))).size,
      buildCount: new Set(obs.map((o) => o.build)).size,
      latestBuild: f?.build ?? null, ageDays: f ? ageDaysOf(f.observedAt, now) : null},
    journeys: byJourney,
  };
}

export function buildEntity(id, now) {
  if (!BUILDS.includes(id)) return null;
  const obs = OBSERVATIONS.filter((o) => o.build === id);
  const times = obs.map((o) => o.observedAt).sort();
  const idx = BUILDS.indexOf(id);
  return {
    build: id,
    prevBuild: idx > 0 ? BUILDS[idx - 1] : null,
    kpis: {observationCount: obs.reduce((n, o) => n + o.obsCount, 0),
      laneCount: new Set(obs.map((o) => o.lane)).size,
      journeyCount: new Set(obs.map((o) => o.journey)).size},
    window: {first: times[0] ?? null, last: times.at(-1) ?? null},
    observed: obs.map((o) => ({journey: JOURNEYS.find((j) => j.id === o.journey),
      lane: LANES.find((l) => l.id === o.lane), market: o.market, locale: o.locale,
      runId: o.runId, observedAt: o.observedAt,
      screenCount: new Set(o.walk.map((w) => w.stack.at(-1))).size})),
  };
}

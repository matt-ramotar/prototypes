import {BUILDS, JOURNEYS, LANES, OBSERVATIONS, REPORTS, SCREENS} from "./fixtures.js";

const ageDaysOf = (iso, now) => Math.floor((now - new Date(iso)) / 86400000);

function freshest(obs) {
  return [...obs].sort((a, b) => BUILDS.indexOf(b.build) - BUILDS.indexOf(a.build) ||
    new Date(b.observedAt) - new Date(a.observedAt))[0] ?? null;
}

export function catalogCounts() {
  const all = Object.values(SCREENS);
  return {
    screens: all.filter((s) => s.kind === "SCREEN").length,
    overlays: all.filter((s) => s.kind === "OVERLAY").length,
    journeys: JOURNEYS.length,
    lanes: LANES.length,
    builds: BUILDS.length,
    reports: REPORTS.length,
  };
}

export function screenRows(now) {
  return Object.values(SCREENS).map((screen) => {
    const containing = OBSERVATIONS.filter((o) => o.walk.some((w) => w.stack.includes(screen.key)));
    const laneIds = [...new Set(containing.map((o) => o.lane))];
    const variantSet = [...new Set(containing.flatMap((o) =>
      o.walk.filter((w) => w.stack.at(-1) === screen.key).flatMap((w) => w.variants)))];
    const f = freshest(containing);
    return {
      screen,
      journey: JOURNEYS.find((j) => j.id === screen.journeyId),
      laneIds,
      variantSet,
      latestBuild: f?.build ?? null,
      ageDays: f ? ageDaysOf(f.observedAt, now) : null,
    };
  }).sort((a, b) => (a.screen.label ?? a.screen.derivedLabel)
    .localeCompare(b.screen.label ?? b.screen.derivedLabel));
}

export function filterScreenRows(rows, filters = {}) {
  const {q, kind, journey, phase, lane, variant, naming} = filters;
  const needle = q?.trim().toLowerCase();
  return rows.filter((r) =>
    (!kind || r.screen.kind === kind) &&
    (!journey || r.screen.journeyId === journey) &&
    (!phase || r.screen.phase === phase) &&
    (!lane || r.laneIds.includes(lane)) &&
    (!variant || r.variantSet.includes(variant)) &&
    (!naming || (naming === "named" ? r.screen.label != null : r.screen.label == null)) &&
    (!needle || [r.screen.label, r.screen.derivedLabel, r.screen.key]
      .some((s) => s?.toLowerCase().includes(needle))));
}

export function screenFilterOptions() {
  const all = Object.values(SCREENS);
  return {
    journeys: JOURNEYS.map((j) => ({id: j.id, label: j.label})),
    phases: [...new Set(JOURNEYS.flatMap((j) => j.phases))],
    lanes: LANES.map((l) => ({id: l.id, label: `${l.container} · ${l.platform}`})),
    variants: [...new Set(OBSERVATIONS.flatMap((o) => o.walk.flatMap((w) => w.variants)))],
  };
}

export function journeyRows(now) {
  return JOURNEYS.map((journey) => {
    const obs = OBSERVATIONS.filter((o) => o.journey === journey.id);
    const f = freshest(obs);
    return {
      journey,
      laneCount: new Set(obs.map((o) => o.lane)).size,
      screenCount: Object.values(SCREENS).filter((s) => s.journeyId === journey.id).length,
      latestBuild: f?.build ?? null,
      ageDays: f ? ageDaysOf(f.observedAt, now) : null,
    };
  });
}

export function laneRows(now) {
  return LANES.map((lane) => {
    const obs = OBSERVATIONS.filter((o) => o.lane === lane.id);
    const screens = new Set(obs.flatMap((o) => o.walk.flatMap((w) => w.stack)));
    const f = freshest(obs);
    return {
      lane,
      journeyCount: new Set(obs.map((o) => o.journey)).size,
      screenCount: screens.size,
      latestBuild: f?.build ?? null,
      ageDays: f ? ageDaysOf(f.observedAt, now) : null,
      observed: obs.length > 0,
    };
  });
}

/** Prefer a Given observed on both builds so Compare opens a real diff. */
export function comparePatch(build, prevBuild) {
  const a = OBSERVATIONS.filter((o) => o.build === build);
  const b = OBSERVATIONS.filter((o) => o.build === prevBuild);
  const seed = a.find((o) => b.some((p) =>
    p.lane === o.lane && p.journey === o.journey && p.market === o.market
    && p.locale === o.locale && p.cohort === o.cohort)) ?? a[0];
  if (!seed) return null;
  const lane = LANES.find((l) => l.id === seed.lane);
  return {
    journey: seed.journey,
    container: lane.container.toLowerCase(),
    platform: lane.platform.toLowerCase(),
    cohort: seed.cohort,
    locale: seed.locale,
    market: seed.market,
    build,
    pivot: "build",
    counterpart: prevBuild,
    view: "report",
  };
}

export function buildRows(now) {
  return [...BUILDS].reverse().map((build) => {
    const obs = OBSERVATIONS.filter((o) => o.build === build);
    const times = obs.map((o) => o.observedAt).sort();
    const idx = BUILDS.indexOf(build);
    return {
      build,
      firstObservedAt: times[0] ?? null,
      lastObservedAt: times.at(-1) ?? null,
      observationCount: obs.reduce((n, o) => n + o.obsCount, 0),
      laneCount: new Set(obs.map((o) => o.lane)).size,
      journeyCount: new Set(obs.map((o) => o.journey)).size,
      prevBuild: idx > 0 ? BUILDS[idx - 1] : null,
    };
  });
}

import {BUILDS, JOURNEYS, LANES, OBSERVATIONS, SCREENS, THIN_OBSERVATION_FLOOR} from "./fixtures.js";

export const CELL_STATE_LABELS = {fresh: "Fresh", stale: "Stale", thin: "Thin", none: "not walked"};

export function atlasCells(context, now) {
  const cells = [];
  for (const j of JOURNEYS) {
    for (const l of LANES) {
      const obs = OBSERVATIONS.filter((ob) =>
        ob.journey === j.id && ob.lane === l.id &&
        ob.cohort === context.cohort && ob.locale === context.locale && ob.market === context.market);
      if (obs.length === 0) {
        cells.push({journeyId: j.id, laneId: l.id, state: "none",
          screenCount: 0, obsCount: 0, build: null, ageDays: null});
        continue;
      }
      const freshest = [...obs].sort((a, b) => BUILDS.indexOf(b.build) - BUILDS.indexOf(a.build))[0];
      const exact = obs.find((ob) => ob.build === context.build);
      const chosen = exact ?? freshest;
      const state = chosen.obsCount < THIN_OBSERVATION_FLOOR ? "thin" : exact ? "fresh" : "stale";
      const screenCount = new Set(chosen.walk.map((w) => w.stack.at(-1)))
        .size;
      cells.push({
        journeyId: j.id, laneId: l.id, state,
        screenCount, obsCount: chosen.obsCount, build: chosen.build,
        ageDays: Math.floor((now - new Date(chosen.observedAt)) / 86400000),
      });
    }
  }
  return cells;
}

import {test} from "node:test";
import assert from "node:assert/strict";
import {atlasCells} from "./atlas-view.js";
import {JOURNEYS, LANES} from "./fixtures.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const ctx = {cohort: "new", locale: "en-US", market: "US", build: "8.112"};

test("grid covers every journey × lane", () => {
  const cells = atlasCells(ctx, NOW);
  assert.equal(cells.length, JOURNEYS.length * LANES.length);
});

test("states: fresh, stale, thin, none", () => {
  const cells = atlasCells(ctx, NOW);
  const at = (j, l) => cells.find((c) => c.journeyId === j && c.laneId === l);
  assert.equal(at("onboarding", "meals-android").state, "fresh");
  assert.equal(at("onboarding", "meals-android").screenCount, 7);
  assert.equal(at("onboarding", "meals-ios").state, "stale");
  assert.equal(at("onboarding", "meals-ios").build, "8.98");
  assert.equal(at("checkout", "meals-ios").state, "thin");
  assert.equal(at("onboarding", "trips-android").state, "none");
});

test("context is exact: DE context does not see US observations", () => {
  const cells = atlasCells({...ctx, locale: "de-DE", market: "DE"}, NOW);
  const cell = cells.find((c) => c.journeyId === "checkout" && c.laneId === "meals-android");
  assert.equal(cell.state, "none");
});

import {test} from "node:test";
import assert from "node:assert/strict";
import {catalogCounts, screenRows, filterScreenRows, screenFilterOptions,
  journeyRows, laneRows, buildRows, comparePatch} from "./catalog-view.js";
import {SCREENS, JOURNEYS, LANES, BUILDS} from "./fixtures.js";

const NOW = new Date("2026-08-23T12:00:00Z");

test("catalogCounts derives from fixtures", () => {
  const c = catalogCounts();
  const all = Object.values(SCREENS);
  assert.equal(c.screens, all.filter((s) => s.kind === "SCREEN").length);
  assert.equal(c.overlays, all.filter((s) => s.kind === "OVERLAY").length);
  assert.equal(c.journeys, JOURNEYS.length);
  assert.equal(c.lanes, LANES.length);
  assert.equal(c.builds, BUILDS.length);
});

test("screenRows: observed screens carry lanes and freshness; unobserved carry nulls", () => {
  const rows = screenRows(NOW);
  assert.equal(rows.length, Object.keys(SCREENS).length);
  const phone = rows.find((r) => r.screen.key === "onb/phone#77c1");
  assert.deepEqual([...phone.laneIds].sort(), ["meals-android", "meals-ios"]);
  assert.equal(phone.latestBuild, "8.112");
  assert.equal(phone.ageDays, 2);
  assert.ok(phone.variantSet.includes("ERROR"));
});

test("filterScreenRows: kind, journey, variant, naming, q", () => {
  const rows = screenRows(NOW);
  assert.ok(filterScreenRows(rows, {kind: "OVERLAY"}).every((r) => r.screen.kind === "OVERLAY"));
  assert.ok(filterScreenRows(rows, {journey: "search"}).every((r) => r.screen.journeyId === "search"));
  const err = filterScreenRows(rows, {variant: "ERROR"});
  assert.ok(err.length >= 3 && err.every((r) => r.variantSet.includes("ERROR")));
  assert.ok(filterScreenRows(rows, {naming: "derived"}).every((r) => r.screen.label == null));
  const q = filterScreenRows(rows, {q: "phone"});
  assert.ok(q.some((r) => r.screen.key === "onb/phone#77c1"));
});

test("screenFilterOptions are derived and deduped", () => {
  const o = screenFilterOptions();
  assert.equal(o.journeys.length, JOURNEYS.length);
  assert.ok(o.variants.includes("ERROR"));
  assert.equal(new Set(o.phases).size, o.phases.length);
});

test("journeyRows and laneRows summarize coverage", () => {
  const j = journeyRows(NOW).find((r) => r.journey.id === "search");
  assert.equal(j.laneCount, 1);
  assert.equal(j.screenCount, Object.values(SCREENS).filter((s) => s.journeyId === "search").length);
  const trips = laneRows(NOW).find((r) => r.lane.id === "trips-ios");
  assert.equal(trips.observed, false);
  assert.equal(trips.journeyCount, 0);
});

test("comparePatch: prefers a Given observed on both builds", () => {
  const patch = comparePatch("8.112", "8.104");
  assert.equal(patch.journey, "tracking");
  assert.equal(patch.container, "meals");
  assert.equal(patch.platform, "android");
  assert.equal(patch.counterpart, "8.104");
});

test("buildRows: newest first with prevBuild chain", () => {
  const rows = buildRows(NOW);
  assert.equal(rows[0].build, "8.112");
  assert.equal(rows[0].prevBuild, "8.104");
  assert.equal(rows.at(-1).build, "8.90");
  assert.equal(rows.at(-1).prevBuild, null);
  assert.ok(rows[0].observationCount >= 4);
});

import {test} from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_CONTEXT, buildLedger, coverage, journeyStrips, signals} from "./landing-view.js";
import {BUILDS, JOURNEYS, LANES} from "./fixtures.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const CTX = {cohort: "new", locale: "en-US", market: "US", build: "8.112"};

test("DEFAULT_CONTEXT points at the newest build", () => {
  assert.equal(DEFAULT_CONTEXT.build, BUILDS.at(-1));
});

test("coverage counts every journey × lane and partitions them by state", () => {
  const cov = coverage(CTX, NOW);
  assert.equal(cov.total, JOURNEYS.length * LANES.length);
  assert.deepEqual(cov.byState, {fresh: 5, stale: 2, thin: 1, none: 17});
  assert.equal(cov.observed, 8);
  assert.equal(cov.observed + cov.byState.none, cov.total);
  assert.equal(cov.screens, 41);
  assert.equal(cov.percent, 32);
});

test("coverage is context-exact: a DE Given sees a different map", () => {
  const de = coverage({...CTX, locale: "de-DE", market: "DE"}, NOW);
  assert.equal(de.observed, 1);
  assert.equal(de.byState.none, de.total - 1);
});

test("signals pick freshest by age, stalest by age, thinnest by observation count", () => {
  const s = signals(CTX, NOW);
  assert.equal(s.freshest.journeyId, "tracking");
  assert.equal(s.freshest.ageDays, 1);
  assert.equal(s.stalest.journeyId, "onboarding");
  assert.equal(s.stalest.laneId, "meals-ios");
  assert.equal(s.stalest.ageDays, 32);
  assert.equal(s.thinnest.journeyId, "checkout");
  assert.equal(s.thinnest.obsCount, 1);
  // decorated with the entities the cards render
  assert.equal(s.freshest.journey.label, "Order Tracking");
  assert.equal(s.freshest.lane.container, "Meals");
});

test("signals are null when the Given has no observation at all", () => {
  const s = signals({cohort: "new", locale: "de-DE", market: "US", build: "8.112"}, NOW);
  assert.equal(s.freshest, null);
  assert.equal(s.stalest, null);
  assert.equal(s.thinnest, null);
});

test("journeyStrips carry the freshest walk per journey with its lane", () => {
  const strips = journeyStrips(CTX, NOW);
  assert.equal(strips.length, JOURNEYS.length);
  const onboarding = strips.find((s) => s.journey.id === "onboarding");
  assert.equal(onboarding.lane.id, "meals-android");
  assert.equal(onboarding.answer.steps.length, 8);
  assert.equal(onboarding.state, "fresh");
  const search = strips.find((s) => s.journey.id === "search");
  assert.equal(search.answer.steps.length, 10);
});

test("journeyStrips report a null answer rather than borrowing another Given", () => {
  const strips = journeyStrips({...CTX, locale: "de-DE", market: "DE"}, NOW);
  const checkout = strips.find((s) => s.journey.id === "checkout");
  assert.equal(checkout.answer, null);
  assert.equal(checkout.lane, null);
  assert.equal(checkout.ageDays, null);
});

test("buildLedger runs newest first and carries per-build observation totals", () => {
  const rows = buildLedger(NOW);
  assert.deepEqual(rows.map((r) => r.build), [...BUILDS].reverse());
  assert.equal(rows[0].build, "8.112");
  assert.equal(rows[0].prevBuild, "8.104");
  assert.equal(rows[0].observationCount, 34);
  assert.equal(rows[0].journeyIds.length, 5);
  assert.equal(rows[0].screenCount, 40);
  assert.equal(rows.at(-1).prevBuild, null);
});

test("movement is only claimed across Givens observed on both builds", () => {
  const rows = buildLedger(NOW);
  const latest = rows[0];
  assert.equal(latest.comparable, 1);
  assert.deepEqual(latest.added.map((s) => s.key).sort(),
    ["ot/rate-order#d207", "ovl/tip-prompt#d208"]);
  assert.deepEqual(latest.removed, []);
  assert.deepEqual(latest.changed, []);

  // b8.104 shares no Given with b8.98, so it must claim nothing.
  const prior = rows.find((r) => r.build === "8.104");
  assert.equal(prior.comparable, 0);
  assert.deepEqual([prior.added, prior.removed, prior.changed], [[], [], []]);
});

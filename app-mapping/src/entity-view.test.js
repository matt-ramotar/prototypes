import {test} from "node:test";
import assert from "node:assert/strict";
import {screenEntity, journeyEntity, laneEntity, buildEntity} from "./entity-view.js";

const NOW = new Date("2026-08-23T12:00:00Z");

test("screenEntity: phone has two lanes, two compositions, ERROR in set", () => {
  const e = screenEntity("onb/phone#77c1", NOW);
  assert.equal(e.kpis.laneCount, 2);
  assert.equal(e.kpis.compositionCount, 2);
  assert.ok(e.kpis.variantSet.includes("ERROR"));
  assert.equal(e.kpis.latestBuild, "8.112");
  assert.ok(e.appearsIn.length >= 3);
  assert.ok(e.edgesOut.some((x) => x.to === "ovl/sms-consent#19bd"));
  assert.equal(screenEntity("nope/nothing#0000", NOW), null);
});

test("journeyEntity: atlas row filtered to the journey in default context", () => {
  const e = journeyEntity("search", NOW);
  assert.equal(e.kpis.screenCount, 11);
  assert.equal(e.atlasRow.length, 5);
  assert.ok(e.atlasRow.every((c) => c.journeyId === "search"));
  assert.equal(e.atlasRow.find((c) => c.laneId === "meals-android").state, "fresh");
  assert.equal(e.phaseListing.length, 4);
  assert.equal(journeyEntity("nope", NOW), null);
});

test("laneEntity: meals-android covers all five journeys minus unobserved ones", () => {
  const e = laneEntity("meals-android", NOW);
  assert.equal(e.kpis.journeyCount, 5);
  assert.ok(e.kpis.buildCount >= 3);
  const unwalked = laneEntity("trips-ios", NOW);
  assert.equal(unwalked.kpis.journeyCount, 0);
});

test("buildEntity: 8.112 has prev 8.104 and an observed listing", () => {
  const e = buildEntity("8.112", NOW);
  assert.equal(e.prevBuild, "8.104");
  assert.ok(e.kpis.observationCount > 0);
  assert.ok(e.observed.every((o) => typeof o.screenCount === "number"));
  assert.equal(buildEntity("9.999", NOW), null);
});

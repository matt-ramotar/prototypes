import {test} from "node:test";
import assert from "node:assert/strict";
import {
  MAP_VERSION, THIN_OBSERVATION_FLOOR, BUILDS, LANES, JOURNEYS,
  SCREENS, EDGES, OBSERVATIONS,
} from "./fixtures.js";

test("constants", () => {
  assert.equal(MAP_VERSION, 41);
  assert.equal(THIN_OBSERVATION_FLOOR, 3);
  assert.ok(BUILDS.includes("8.98") && BUILDS.includes("8.112"));
  assert.equal(BUILDS.at(-1), "8.112");
  assert.ok(BUILDS.every((b, i) => i === 0 || BUILDS.indexOf(b) > BUILDS.indexOf(BUILDS[i - 1])), "ascending");
});

test("every walk stack is top-first with exactly one base SCREEN, last", () => {
  for (const ob of OBSERVATIONS) {
    for (const step of ob.walk) {
      const kinds = step.stack.map((k) => SCREENS[k].kind);
      assert.equal(kinds.at(-1), "SCREEN", `${ob.lane} ${step.stack}`);
      assert.ok(kinds.slice(0, -1).every((k) => k === "OVERLAY"));
      assert.ok(step.stack.length - 1 <= 2, "overlay depth <= 2");
    }
  }
});

test("every edge endpoint is a known screen", () => {
  for (const e of EDGES) {
    assert.ok(SCREENS[e.from], e.from);
    assert.ok(SCREENS[e.to], e.to);
  }
});

test("every observation references a known lane, journey, build", () => {
  const laneIds = new Set(LANES.map((l) => l.id));
  const journeyIds = new Set(JOURNEYS.map((j) => j.id));
  for (const ob of OBSERVATIONS) {
    assert.ok(laneIds.has(ob.lane));
    assert.ok(journeyIds.has(ob.journey));
    assert.ok(BUILDS.includes(ob.build));
  }
});

test("diff scenario is present: DE-only, US-only, changed variant set", () => {
  const de = OBSERVATIONS.find((o) => o.lane === "meals-android" && o.market === "DE" && o.build === "8.112" && o.journey === "onboarding");
  const us = OBSERVATIONS.find((o) => o.lane === "meals-android" && o.market === "US" && o.build === "8.112" && o.journey === "onboarding");
  assert.ok(de && us);
  const keys = (o) => new Set(o.walk.flatMap((s) => s.stack));
  const deKeys = keys(de), usKeys = keys(us);
  assert.ok(deKeys.has("ovl/eu-consent#4c19") && !usKeys.has("ovl/eu-consent#4c19"));
  assert.ok(usKeys.has("onb/tipping-intro#20fe") && !deKeys.has("onb/tipping-intro#20fe"));
  const deAddr = de.walk.find((s) => s.stack.at(-1) === "onb/address#91aa");
  const usAddr = us.walk.find((s) => s.stack.at(-1) === "onb/address#91aa");
  assert.deepEqual(deAddr.variants, ["POPULATED", "ERROR"]);
  assert.deepEqual(usAddr.variants, ["POPULATED"]);
});

test("a non-traversable toast edge and an occluded stack entry exist", () => {
  assert.ok(EDGES.some((e) => !e.traversable && SCREENS[e.to].kind === "OVERLAY"));
  assert.ok(OBSERVATIONS.some((o) => o.walk.some((s) => s.occluded.length > 0)));
});

test("expansion: journeys carry description and team; lanes carry description", () => {
  assert.equal(JOURNEYS.length, 5);
  for (const j of JOURNEYS) {
    assert.equal(typeof j.description, "string");
    assert.ok(j.description.length > 0);
    assert.equal(typeof j.team, "string");
  }
  assert.equal(LANES.length, 5);
  for (const l of LANES) assert.equal(typeof l.description, "string");
});

test("expansion: trips and bazaar lanes have zero observations (honest maturity)", () => {
  for (const laneId of ["trips-android", "trips-ios", "bazaar-android"])
    assert.ok(!OBSERVATIONS.some((o) => o.lane === laneId), laneId);
});

test("expansion: no new DE observations beyond the pinned onboarding story", () => {
  const de = OBSERVATIONS.filter((o) => o.market === "DE");
  assert.equal(de.length, 1);
  assert.equal(de[0].journey, "onboarding");
});

test("expansion: every screen's phase is in its journey's phase list", () => {
  const byId = Object.fromEntries(JOURNEYS.map((j) => [j.id, j]));
  for (const s of Object.values(SCREENS))
    assert.ok(byId[s.journeyId].phases.includes(s.phase), `${s.key} phase ${s.phase}`);
});

test("expansion: pinned DE/US walks are untouched", () => {
  const de = OBSERVATIONS.find((o) => o.market === "DE" && o.build === "8.112" && o.journey === "onboarding");
  const us = OBSERVATIONS.find((o) => o.market === "US" && o.lane === "meals-android" && o.build === "8.112" && o.journey === "onboarding");
  assert.equal(de.walk.length, 9);
  assert.equal(us.walk.length, 8);
  assert.deepEqual(de.walk[7].variants, ["POPULATED", "ERROR"]);
});


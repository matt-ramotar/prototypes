import {test} from "node:test";
import assert from "node:assert/strict";
import {parseQuery, serializeQuery, canonicalize, resolveAnswer, laneFor} from "./query.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const DE = "?journey=onboarding&container=meals&platform=android&cohort=new&locale=de-DE&market=DE&build=8.112";

test("parse/serialize round-trip in canonical order", () => {
  const q = parseQuery(DE);
  assert.equal(q.journey, "onboarding");
  assert.equal(serializeQuery(q), DE);
});

test("canonicalize: unknown build nulls with note; unknown journey nulls", () => {
  const {query: q1, notes: n1} = canonicalize(parseQuery(DE.replace("8.112", "9.999")));
  assert.equal(q1.build, null);
  assert.ok(n1.length > 0);
  const {query: q2} = canonicalize(parseQuery("?journey=nope"));
  assert.equal(q2.journey, null);
});

test("canonicalize: pivot without differing counterpart is dropped", () => {
  const {query} = canonicalize(parseQuery(DE + "&pivot=market&counterpart=DE"));
  assert.equal(query.pivot, null);
  assert.equal(query.counterpart, null);
});

test("resolve: exact Given answers with enriched steps and counts", () => {
  const r = resolveAnswer(canonicalize(parseQuery(DE)).query, NOW);
  assert.equal(r.kind, "answer");
  assert.equal(r.answer.steps.length, 9);
  assert.equal(r.answer.counts.screens, 7);
  assert.equal(r.answer.counts.overlays, 4);
  assert.equal(r.answer.thin, false);
  assert.equal(r.answer.offSpine.length, 1);
  assert.equal(r.answer.offSpine[0].key, "ovl/otp-toast#d0d0");
  assert.equal(r.answer.steps[2].baseScreen.key, "onb/phone#77c1");
  assert.equal(r.answer.ageDays, 2);
});

test("resolve: requested build unobserved offers stale candidate, never substitutes", () => {
  const q = canonicalize(parseQuery(DE.replace("market=DE", "market=US").replace("locale=de-DE", "locale=en-US").replace("8.112", "8.98"))).query;
  const r = resolveAnswer(q, NOW);
  assert.equal(r.kind, "answer"); // 8.98 US IS observed
  const q2 = canonicalize(parseQuery(DE.replace("8.112", "8.98"))).query; // DE 8.98 not observed
  const r2 = resolveAnswer(q2, NOW);
  assert.equal(r2.kind, "stale-candidate");
  assert.equal(r2.requestedBuild, "8.98");
  assert.equal(r2.candidate.given.build, "8.112");
});

test("resolve: not-walked carries reason and nearest observed Given", () => {
  const q = canonicalize(parseQuery("?journey=onboarding&container=trips&platform=android&cohort=new&locale=en-US&market=US&build=8.112")).query;
  const r = resolveAnswer(q, NOW);
  assert.equal(r.kind, "not-walked");
  assert.equal(r.reason, "lane-not-in-crawl-set");
  assert.equal(laneFor(r.nearest).id, "meals-android");
});

test("resolve: thin flag from THIN_OBSERVATION_FLOOR", () => {
  const q = canonicalize(parseQuery("?journey=checkout&container=meals&platform=ios&cohort=new&locale=en-US&market=US&build=8.112")).query;
  const r = resolveAnswer(q, NOW);
  assert.equal(r.kind, "answer");
  assert.equal(r.answer.thin, true);
});

test("resolve: query with no build param resolves to freshest observed build (answer kind)", () => {
  const q = canonicalize(parseQuery(DE.replace("&build=8.112", ""))).query;
  assert.equal(q.build, null);
  const r = resolveAnswer(q, NOW);
  assert.equal(r.kind, "answer");
  assert.equal(r.answer.given.build, "8.112");
});

test("canonicalize: valid pivot with a differing counterpart passes through untouched", () => {
  const {query, notes} = canonicalize(parseQuery(DE + "&pivot=market&counterpart=US"));
  assert.equal(query.pivot, "market");
  assert.equal(query.counterpart, "US");
  assert.equal(notes.length, 0); // no note about pivot (or anything else — this Given is fully valid)
});

test("resolve: not-walked reason is context-not-observed-in-lane when lane+journey are observed but not this Given", () => {
  const q = canonicalize(parseQuery("?journey=onboarding&container=meals&platform=ios&cohort=new&locale=de-DE&market=DE&build=8.98")).query;
  const r = resolveAnswer(q, NOW);
  assert.equal(r.kind, "not-walked");
  assert.equal(r.reason, "context-not-observed-in-lane");
});
// "journey-not-observed-in-lane" has no fixture case to exercise it: every lane in fixtures.js
// that has any OBSERVATIONS row (meals-android, meals-ios) has rows for both the onboarding and
// checkout journeys, so no lane+journey combination currently falls into that reason. The
// lane-not-in-crawl-set reason is already covered above by "resolve: not-walked carries reason
// and nearest observed Given" (trips-android, which has zero observation rows).

test("resolve: query with no lane resolves to atlas kind", () => {
  const r = resolveAnswer(parseQuery("?journey=onboarding"), NOW);
  assert.equal(r.kind, "atlas");
});

test("canonicalize: platform supplied with no matching lane nulls platform and leaves a note", () => {
  const {query, notes} = canonicalize(parseQuery("?platform=android"));
  assert.equal(query.platform, null);
  assert.ok(notes.length > 0);
});

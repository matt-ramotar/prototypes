import {test} from "node:test";
import assert from "node:assert/strict";
import {GRAPH_STATES, laneOf, observedTransitions, threadGraph, threads} from "./thread-graph.js";
import {EDGES, JOURNEYS, OBSERVATIONS, SCREENS} from "./fixtures.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const ALL = JOURNEYS.map((j) => j.id);
const ANDROID = {cohort: "new", locale: "en-US", market: "US", build: "8.112",
  container: "meals", platform: "android"};

test("laneOf resolves case-insensitively and refuses an unknown lane", () => {
  assert.equal(laneOf(ANDROID).id, "meals-android");
  assert.equal(laneOf({container: "MEALS", platform: "IOS"}).id, "meals-ios");
  assert.equal(laneOf({container: "nope", platform: "android"}), null);
  assert.equal(laneOf({}), null);
});

test("observedTransitions reads stack tops, so an overlay opening is not a self-loop", () => {
  const all = observedTransitions(OBSERVATIONS);
  assert.equal(all.size, 37);
  for (const [id, t] of all) {
    assert.notEqual(t.from, t.to, `${id} is a self-transition`);
    assert.ok(t.runs.size > 0);
  }
  // phone -> sms consent is stack adjacency; the walk's next base is phone again.
  assert.ok(all.has("onb/phone#77c1>ovl/sms-consent#19bd"));
  assert.ok(!all.has("onb/phone#77c1>onb/phone#77c1"));
});

test("the declared graph and the observed graph genuinely differ", () => {
  const observed = observedTransitions(OBSERVATIONS);
  const declared = new Set(EDGES.map((e) => `${e.from}>${e.to}`));
  const both = [...observed.keys()].filter((id) => declared.has(id));
  const observedOnly = [...observed.keys()].filter((id) => !declared.has(id));
  const declaredOnly = [...declared].filter((id) => !observed.has(id));
  assert.equal(declared.size, 36);
  assert.equal(both.length, 27);
  assert.equal(observedOnly.length, 10);
  assert.equal(declaredOnly.length, 9);
  // every non-traversable edge is declared and never walked — that is what it means
  for (const e of EDGES.filter((x) => !x.traversable)) {
    assert.ok(!observed.has(`${e.from}>${e.to}`), `${e.from}>${e.to} was walked`);
  }
});

test("whole-map graph under the default Given", () => {
  const g = threadGraph(ALL, ANDROID, NOW);
  assert.equal(g.nodes.length, Object.keys(SCREENS).length);
  assert.deepEqual(g.counts, {
    nodes: 43,
    declaredEdges: 36,
    undeclaredEdges: 10,
    byNodeState: {fresh: 36, stale: 0, elsewhere: 4, never: 3},
  });
  for (const n of g.nodes) assert.ok(GRAPH_STATES.includes(n.state));
  for (const e of g.edges) assert.ok(GRAPH_STATES.includes(e.state));
});

test("moving the market relights the onboarding branch, and nothing else moves", () => {
  const us = threadGraph(["onboarding"], ANDROID, NOW);
  const de = threadGraph(["onboarding"], {...ANDROID, market: "DE", locale: "de-DE"}, NOW);
  const state = (g, key) => g.nodes.find((n) => n.key === key).state;

  assert.equal(state(us, "onb/tipping-intro#20fe"), "fresh");
  assert.equal(state(de, "onb/tipping-intro#20fe"), "elsewhere");
  assert.equal(state(us, "ovl/eu-consent#4c19"), "elsewhere");
  assert.equal(state(de, "ovl/eu-consent#4c19"), "fresh");
  assert.equal(state(us, "onb/marketing-optin#b7e0"), "elsewhere");
  assert.equal(state(de, "onb/marketing-optin#b7e0"), "fresh");

  assert.deepEqual(us.counts.byNodeState, {fresh: 8, stale: 0, elsewhere: 4, never: 1});
  assert.deepEqual(de.counts.byNodeState, {fresh: 11, stale: 0, elsewhere: 1, never: 1});
  // the node set never changes — only its lighting does
  assert.deepEqual(us.nodes.map((n) => n.key), de.nodes.map((n) => n.key));
});

test("a lane that never walked a journey reports elsewhere, never fresh", () => {
  const g = threadGraph(["search"], {...ANDROID, platform: "ios"}, NOW);
  assert.deepEqual(g.counts.byNodeState, {fresh: 0, stale: 0, elsewhere: 10, never: 1});
});

test("stale means observed under this Given but on an older build", () => {
  const at112 = threadGraph(["account"], {...ANDROID, platform: "ios"}, NOW);
  assert.deepEqual(at112.counts.byNodeState, {fresh: 0, stale: 7, elsewhere: 2, never: 0});
  const at104 = threadGraph(["account"], {...ANDROID, platform: "ios", build: "8.104"}, NOW);
  assert.deepEqual(at104.counts.byNodeState, {fresh: 7, stale: 0, elsewhere: 2, never: 0});
});

test("an unresolvable lane degrades honestly instead of borrowing another lane", () => {
  const g = threadGraph(["search"], {...ANDROID, container: "nope"}, NOW);
  assert.equal(g.lane, null);
  assert.equal(g.counts.byNodeState.fresh, 0);
  assert.equal(g.counts.byNodeState.stale, 0);
});

test("threads are declared root-to-leaf paths, scored by how much this Given walked", () => {
  const g = threadGraph(ALL, ANDROID, NOW);
  const {declared, undeclared} = threads(g);
  assert.equal(declared.length, 14);
  assert.equal(undeclared.length, 10);
  for (const t of declared) {
    assert.equal(t.legs.length, t.keys.length - 1);
    assert.ok(["walked", "partial", "unwalked"].includes(t.state));
    assert.equal(t.state === "walked", t.walkedLegs === t.legs.length);
  }
  // the two sides of the onboarding diamond are separate threads
  const onboarding = declared.filter((t) => t.journeyId === "onboarding");
  assert.equal(onboarding.length, 3);
  const walked = onboarding.filter((t) => t.state === "walked");
  assert.equal(walked.length, 1);
  assert.ok(walked[0].keys.includes("onb/tipping-intro#20fe"));
  assert.ok(!walked[0].keys.includes("ovl/eu-consent#4c19"));
});

test("an observed transition is never promoted into the declared thread list", () => {
  const g = threadGraph(["checkout"], ANDROID, NOW);
  const {declared, undeclared} = threads(g);
  // Checkout is observed (Cart then Payment) but declares no edge at all.
  assert.deepEqual(declared, []);
  assert.equal(undeclared.length, 1);
  assert.equal(undeclared[0].id, "chk/cart#11ab>chk/pay#22bc");
  assert.equal(undeclared[0].declared, false);
  assert.equal(undeclared[0].state, "fresh");
});

test("threadGraph is pure and deterministic", () => {
  const a = threadGraph(ALL, ANDROID, NOW);
  const b = threadGraph(ALL, ANDROID, NOW);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

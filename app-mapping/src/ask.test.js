import {test} from "node:test";
import assert from "node:assert/strict";
import {ask, entityMatches, PROVENANCE, SUGGESTIONS} from "./ask.js";

const NOW = new Date("2026-08-23T12:00:00Z");

test("entity matches rank screens, journeys, lanes, builds", () => {
  const m = entityMatches("phone");
  assert.ok(m.some((x) => x.type === "screen" && x.id === "onb/phone#77c1"));
  const j = entityMatches("onboarding");
  assert.ok(j.some((x) => x.type === "journey" && x.id === "onboarding"));
  const b = entityMatches("8.112");
  assert.ok(b.some((x) => x.type === "build" && x.id === "8.112"));
  assert.ok(entityMatches("zzzznope").length === 0);
});

test("permutation: the Berlin question resolves to a cited console answer", () => {
  const r = ask("What does a new user in Germany see during Meals Android onboarding?", NOW);
  assert.equal(r.kind, "answer");
  assert.equal(r.intent, "permutation");
  assert.match(r.text, /7 screens/);
  assert.match(r.text, /b8\.112/);
  const screens = r.evidence.find((e) => e.type === "screens");
  assert.ok(screens.items.length >= 4);
  assert.ok(r.links.some((l) => l.path.startsWith("/map?") && l.path.includes("market=DE")));
  assert.equal(r.provenance, PROVENANCE);
});

test("divergence: market comparison answers with diff counts", () => {
  const r = ask("Where do Germany and US differ in onboarding?", NOW);
  assert.equal(r.intent, "divergence");
  const d = r.evidence.find((e) => e.type === "diff");
  assert.equal(d.counts.onlyA, 4);
  assert.equal(d.counts.changed, 5);
  assert.ok(r.links.some((l) => l.path.includes("pivot=market")));
});

test("variant search: error states in a journey", () => {
  const r = ask("What error states exist in search?", NOW);
  assert.equal(r.intent, "variant-search");
  const s = r.evidence.find((e) => e.type === "screens");
  assert.ok(s.items.some((x) => x.key === "sb/search-results#c107"));
});

test("overlay context: where does an overlay appear", () => {
  const r = ask("Where does the SMS consent appear?", NOW);
  assert.equal(r.intent, "overlay-context");
  const st = r.evidence.find((e) => e.type === "stacks");
  assert.ok(st.items.some((x) => x.base === "Phone entry"));
});

test("coverage: not walked on a lane", () => {
  const r = ask("What is not walked on Trips iOS?", NOW);
  assert.equal(r.intent, "coverage");
  const c = r.evidence.find((e) => e.type === "cells");
  assert.ok(c.items.length >= 1);
  assert.ok(c.items.every((x) => x.state === "none"));
});

test("change: what changed in a build", () => {
  const r = ask("What changed in 8.112?", NOW);
  assert.equal(r.intent, "change");
  assert.ok(r.links.some((l) => l.path.includes("pivot=build")));
});

test("miss is honest and never fabricates", () => {
  const r = ask("What is the meaning of life?", NOW);
  assert.equal(r.kind, "miss");
  assert.match(r.text, /couldn.t map/i);
  assert.ok(r.canAnswer.length >= 4);
});

test("bare entity input returns matches, not an answer", () => {
  const r = ask("checkout", NOW);
  assert.equal(r.kind, "matches");
  assert.ok(r.matches.some((m) => m.type === "journey" && m.id === "checkout"));
});

test("suggestions exist and resolve", () => {
  assert.equal(SUGGESTIONS.length, 5);
  for (const s of SUGGESTIONS) assert.equal(ask(s, NOW).kind, "answer", s);
});

import {test} from "node:test";
import assert from "node:assert/strict";
import {parseQuery, canonicalize, resolveAnswer} from "./query.js";
import {computeDiff} from "./diff.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const base = "?journey=onboarding&container=meals&platform=android&cohort=new&build=8.112";
const A = canonicalize(parseQuery(base + "&locale=de-DE&market=DE")).query;
const B = canonicalize(parseQuery(base + "&locale=en-US&market=US")).query;

function answers() {
  const ra = resolveAnswer(A, NOW), rb = resolveAnswer(B, NOW);
  return [ra.answer, rb.answer];
}

test("market pivot reproduces the spec scenario", () => {
  const [a, b] = answers();
  const d = computeDiff(a, b);
  const keys = (xs) => xs.map((x) => x.key).sort();
  assert.deepEqual(keys(d.onlyA), ["onb/marketing-optin#b7e0", "ovl/eu-consent#4c19", "ovl/loc-tooltip#3e77", "ovl/whats-new#66d2"]);
  assert.deepEqual(keys(d.onlyB), ["onb/tipping-intro#20fe"]);
  assert.deepEqual(keys(d.changed), ["onb/address#91aa", "onb/home#f00d", "onb/notif-perm#5b21", "onb/phone#77c1", "onb/verify-1#08aa"]);
  const addr = d.changed.find((c) => c.key === "onb/address#91aa");
  assert.deepEqual(addr.kinds, ["variant-set"]);
  assert.equal(addr.basis, "frozen-key");
  assert.equal(addr.confidence, "high");
});

test("changed detects stack membership difference", () => {
  const [a, b] = answers();
  const d = computeDiff(a, b);
  const home = d.changed.find((c) => c.key === "onb/home#f00d");
  assert.ok(home.kinds.includes("stack"));
});

test("shared + onlyA + onlyB + changed partition all observed nodes", () => {
  const [a, b] = answers();
  const d = computeDiff(a, b);
  const all = new Set([...a.steps, ...b.steps].flatMap((s) => s.stack.map((n) => n.key)));
  const partitioned = d.onlyA.length + d.onlyB.length + d.changed.length + d.shared.length;
  assert.equal(partitioned, all.size);
});

test("byPhase follows journey phase order and excludes shared", () => {
  const [a, b] = answers();
  const d = computeDiff(a, b);
  const phases = d.byPhase.map((p) => p.phase);
  assert.deepEqual(phases, ["Sign up", "Verify", "Permissions", "Setup", "Home"]);
  assert.ok(d.byPhase.every((p) => p.entries.every((e) => e.type !== "shared")));
});

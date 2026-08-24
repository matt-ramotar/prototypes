import {test} from "node:test";
import assert from "node:assert/strict";
import {threadGraph} from "./thread-graph.js";
import {GEOM, anchorEdge, fitTransform, layoutGraph, zoomAt} from "./thread-layout.js";
import {JOURNEYS} from "./fixtures.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const ALL = JOURNEYS.map((j) => j.id);
const ANDROID = {cohort: "new", locale: "en-US", market: "US", build: "8.112",
  container: "meals", platform: "android"};

const lay = (scope, given = ANDROID) => layoutGraph(threadGraph(scope, given, NOW));
const rankOf = (l, key) => l.nodes.find((n) => n.key === key).rank;

function overlaps(nodes) {
  let n = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++;
    }
  }
  return n;
}

test("no two nodes ever overlap, in any scope", () => {
  for (const scope of [["onboarding"], ["checkout"], ["search"], ["tracking"], ["account"], ALL]) {
    assert.equal(overlaps(lay(scope).nodes), 0, `overlap in ${scope.join("+")}`);
  }
});

test("ranking follows declared edges, so the onboarding fork stays a fork", () => {
  const l = lay(["onboarding"]);
  // Notifications permission forks; the two sides run at different ranks and merge.
  const fork = rankOf(l, "onb/notif-perm#5b21");
  assert.equal(rankOf(l, "onb/tipping-intro#20fe"), fork + 1);
  assert.equal(rankOf(l, "ovl/eu-consent#4c19"), fork + 1);
  assert.equal(rankOf(l, "onb/marketing-optin#b7e0"), fork + 2);
  // Address entry is the single merge point: after the longer of the two branches.
  assert.equal(rankOf(l, "onb/address#91aa"), fork + 3);
  const branchA = l.nodes.find((n) => n.key === "onb/tipping-intro#20fe");
  const branchB = l.nodes.find((n) => n.key === "ovl/eu-consent#4c19");
  assert.notEqual(branchA.y, branchB.y, "the two branches must occupy different rows");
  // the merge sits between the rows it merges
  const merge = l.nodes.find((n) => n.key === "onb/address#91aa");
  assert.ok(merge.y > Math.min(branchA.y, branchB.y) && merge.y < Math.max(branchA.y, branchB.y));
});

test("a screen no declared edge touches is placed by what was observed, not left at rank 0", () => {
  const l = lay(["onboarding"]);
  // Location tip and What's new appear only inside observed stacks over Home feed.
  const home = rankOf(l, "onb/home#f00d");
  assert.ok(rankOf(l, "ovl/loc-tooltip#3e77") > home);
  assert.ok(rankOf(l, "ovl/whats-new#66d2") > rankOf(l, "ovl/loc-tooltip#3e77"));
});

test("checkout declares no edge at all and still lays out in walk order", () => {
  const l = lay(["checkout"]);
  assert.equal(l.nodes.length, 2);
  assert.equal(rankOf(l, "chk/cart#11ab"), 0);
  assert.equal(rankOf(l, "chk/pay#22bc"), 1);
});

test("each journey gets its own band and bands never collide", () => {
  const l = lay(ALL);
  assert.equal(l.lanes.length, JOURNEYS.length);
  for (let i = 1; i < l.lanes.length; i++) {
    const prev = l.lanes[i - 1], cur = l.lanes[i];
    assert.ok(cur.y >= prev.y + prev.height, `lane ${cur.journeyId} overlaps ${prev.journeyId}`);
  }
  for (const n of l.nodes) {
    const lane = l.lanes.find((x) => x.journeyId === n.journeyId);
    assert.ok(n.y >= lane.y && n.y + n.h <= lane.y + lane.height + GEOM.rowGap);
  }
});

test("bounds contain every node", () => {
  const l = lay(ALL);
  for (const n of l.nodes) {
    assert.ok(n.x >= 0 && n.y >= 0);
    assert.ok(n.x + n.w <= l.bounds.width, `${n.key} exceeds width`);
    assert.ok(n.y + n.h <= l.bounds.height, `${n.key} exceeds height`);
  }
});

test("every edge is anchored on both nodes and produces a drawable path", () => {
  const l = lay(ALL);
  assert.equal(l.edges.length, 46);
  for (const e of l.edges) {
    assert.ok(Number.isFinite(e.x1) && Number.isFinite(e.y1));
    assert.ok(Number.isFinite(e.x2) && Number.isFinite(e.y2));
    assert.match(e.path, /^M [\d.]+ [\d.]+ C /);
  }
});

test("a same-row forward edge leaves one box's right side and enters the next box's left", () => {
  const a = {x: 0, y: 0, w: 96, h: 176};
  const b = {x: 152, y: 0, w: 96, h: 176};
  const e = anchorEdge(a, b);
  assert.equal(e.x1, 96);
  assert.equal(e.x2, 152);
  assert.equal(e.y1, 88);
  assert.equal(e.y2, 88);
});

test("layout is deterministic", () => {
  assert.deepEqual(lay(ALL), lay(ALL));
});

test("fitTransform centres what fits and never over-magnifies", () => {
  const bounds = {x: 0, y: 0, width: 400, height: 200};
  const t = fitTransform(bounds, {width: 900, height: 600});
  assert.equal(t.scale, 1.1);
  assert.ok(Math.abs((t.x + (bounds.width * t.scale) / 2) - 450) < 1e-6);
  assert.ok(Math.abs((t.y + (bounds.height * t.scale) / 2) - 300) < 1e-6);
});

test("fitTransform floors the scale and pans instead of shrinking past legibility", () => {
  const bounds = {x: 0, y: 0, width: 1000, height: 500};
  const t = fitTransform(bounds, {width: 600, height: 400}, {padding: 32, minScale: 0.72});
  // Fitting would need 0.536, which is unreadable; hold 0.72 and anchor top-left.
  assert.equal(t.scale, 0.72);
  assert.equal(t.x, 32);
  assert.equal(t.y, 32);
});

test("zoomAt keeps the world point under the cursor fixed and respects the clamp", () => {
  const view = {scale: 1, x: -120, y: 40};
  const point = {x: 300, y: 220};
  const world = (v) => ({x: (point.x - v.x) / v.scale, y: (point.y - v.y) / v.scale});
  const before = world(view);
  for (const factor of [1.25, 0.8, 3, 0.1]) {
    const after = world(zoomAt(view, point, factor));
    assert.ok(Math.abs(before.x - after.x) < 1e-9);
    assert.ok(Math.abs(before.y - after.y) < 1e-9);
  }
  assert.equal(zoomAt({scale: 2.4, x: 0, y: 0}, point, 4).scale, 2.5);
  assert.equal(zoomAt({scale: 0.2, x: 0, y: 0}, point, 0.1).scale, 0.15);
});

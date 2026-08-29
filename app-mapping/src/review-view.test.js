import assert from "node:assert/strict";
import {test} from "node:test";
import {
  canAccept, chatReply, confidenceOf, docketOf, docketOrder, guideProse, initialReview, matrixOf,
  nextUnjudged, overlapOf, proposalEntity, questionsFor, reasoningSteps,
  receiptOf, reviewReduce, spliceFor, verifyRoute, yamlDiff, yamlFileFor,
} from "./review-view.js";
import {PROPOSALS} from "./proposal-fixtures.js";

const byId = (id) => PROPOSALS.find((p) => p.id === id);

test("an observed route under an observed Given verifies clean", () => {
  const p = byId("PROP-0031");
  const v = verifyRoute(p.when.route, p.given);
  assert.equal(v.gate, "ok");
  assert.equal(v.blockers.length, 0);
  assert.ok(v.hops.every((h) => h.obsUnder > 0));
});

test("a hop with no observed edge blocks, and the splice repair is found", () => {
  const p = byId("PROP-0032");
  const v = verifyRoute(p.when.route, p.given);
  assert.equal(v.gate, "blocked");
  const broken = v.hops.find((h) => h.missingEdge);
  assert.equal(broken.key, "onb/marketing-optin#b7e0");
  assert.equal(broken.splice, "ovl/eu-consent#4c19");
  assert.equal(spliceFor("onb/notif-perm#5b21", "onb/marketing-optin#b7e0"),
    "ovl/eu-consent#4c19");
});

test("an unmapped screen blocks and offers no splice", () => {
  const p = byId("PROP-0042");
  const v = verifyRoute(p.when.route, p.given);
  assert.equal(v.gate, "blocked");
  const bad = v.hops.find((h) => h.unmapped);
  assert.equal(bad.key, "ot/tip-editor#f9zz");
  assert.equal(bad.splice, null);
});

test("a real route never observed under this Given warns instead of blocking", () => {
  const p = byId("PROP-0043"); // returning cohort — the map has only walked "new"
  const v = verifyRoute(p.when.route, p.given);
  assert.equal(v.gate, "warn");
  assert.equal(v.blockers.length, 0);
});

test("overlap flags the duplicate and the variant, and stays silent on novel routes", () => {
  assert.equal(overlapOf(byId("PROP-0031")).suggestion, "duplicate");
  assert.equal(overlapOf(byId("PROP-0031")).req.id, "REQ-142");
  assert.equal(overlapOf(byId("PROP-0041")).suggestion, "variant");
  assert.equal(overlapOf(byId("PROP-0044")), null);
});

test("a false novelty claim is confirmed false", () => {
  const e = proposalEntity("PROP-0031");
  const novelty = e.claims.find((c) => c.claim === "no catalog overlap");
  assert.equal(novelty.ok, false);
});

test("overreach outranks the boring duplicate in the risk order", () => {
  const overreach = proposalEntity("PROP-0034");
  const duplicate = proposalEntity("PROP-0031");
  assert.ok(overreach.overreach.length > 0);
  assert.ok(overreach.risk.total > duplicate.risk.total);
});

test("the tip-prompt cluster forms a market × cohort matrix", () => {
  const docket = docketOf();
  const factor = docket.find((s) => s.session.id === "factor-7f3a");
  const matrix = factor.clusters.map((c) => c.matrix).find(Boolean);
  assert.ok(matrix);
  assert.deepEqual([matrix.rowFacet, matrix.colFacet].sort(), ["cohort", "market"]);
  assert.equal(matrix.at("US", "new").id, "PROP-0041");
});

test("clusters need a shared route; the differing-Then onboarding pair still clusters without a matrix", () => {
  const factor = docketOf().find((s) => s.session.id === "factor-7f3a");
  const onboarding = factor.clusters.find((c) => c.route.includes("onb/tipping-intro#20fe"));
  assert.equal(onboarding.items.length, 2);
  assert.equal(matrixOf(onboarding.items.map((e) => e.proposal)), null);
});

test("judgments are undoable and batch accepts are labeled as such", () => {
  let state = reviewReduce(initialReview, {type: "judge", id: "PROP-0035", verdict: "accept"});
  state = reviewReduce(state, {type: "batch", ids: ["PROP-0041", "PROP-0043"],
    statement: "vary market × cohort only"});
  assert.equal(state.verdicts["PROP-0041"].via, "batch");
  const receipt = receiptOf(state, docketOrder(docketOf()));
  assert.equal(receipt.countersigned, 3);
  assert.equal(receipt.viaBatch, 2);
  state = reviewReduce(state, {type: "undo"});
  assert.equal(state.verdicts["PROP-0043"], undefined);
  assert.equal(state.verdicts["PROP-0041"].via, "batch");
});

test("the gate fails closed until the amendment repairs the route", () => {
  assert.equal(canAccept(proposalEntity("PROP-0032")), false);
  const spliced = ["onb/verify-1#08aa", "onb/notif-perm#5b21", "ovl/eu-consent#4c19",
    "onb/marketing-optin#b7e0", "onb/address#91aa"];
  const state = reviewReduce(initialReview,
    {type: "amend", id: "PROP-0032", patch: {route: spliced}});
  const repaired = proposalEntity("PROP-0032", state.amendments);
  assert.equal(canAccept(repaired), true);
  assert.equal(repaired.amended, true);
  const judged = reviewReduce(state, {type: "judge", id: "PROP-0032", verdict: "accept"});
  assert.equal(judged.verdicts["PROP-0032"].amended, true);
});

test("questions follow from the analysis, not a script", () => {
  assert.match(questionsFor(proposalEntity("PROP-0031"))[0], /already covered/);
  assert.match(questionsFor(proposalEntity("PROP-0034")).join(" "), /infer/);
  assert.match(questionsFor(proposalEntity("PROP-0042")).join(" "), /real screen|invented/);
  assert.match(questionsFor(proposalEntity("PROP-0052")).join(" "), /rules that depend/);
  assert.equal(questionsFor(proposalEntity("PROP-0035")).length, 0);
});

test("reasoning steps end with the agent's own words, flagged when they overreach", () => {
  const flow = reasoningSteps(proposalEntity("PROP-0034"));
  assert.equal(flow[0].label, "Source");
  assert.equal(flow.at(-1).label, "Reasoning");
  assert.equal(flow.at(-1).flagged, true);
  const run = reasoningSteps(proposalEntity("PROP-0044"));
  assert.equal(run[0].label, "Run");
  assert.equal(run.at(-1).flagged, false);
});

test("chat replies are grounded in the same derivations, and miss honestly", () => {
  const dup = chatReply(proposalEntity("PROP-0031"), "How is this not covered already?");
  assert.match(dup.text, /same route, same given/);
  const reach = chatReply(proposalEntity("PROP-0034"),
    "Did the source actually assert this?");
  assert.match(reach.text, /the agent's inference/);
  const unseen = chatReply(proposalEntity("PROP-0043"), "Will the first run flake?");
  assert.match(unseen.text, /never walked/);
  const miss = chatReply(proposalEntity("PROP-0044"), "What is the meaning of life?");
  assert.match(miss.text, /isn't something the map can answer/);
});

test("the guide narrates in natural language over the confident set only", () => {
  const factor = docketOf().find((s) => s.session.id === "factor-7f3a");
  const confident = [...factor.clusters.flatMap((c) => c.items), ...factor.singletons]
    .filter((e) => confidenceOf(e).confident);
  assert.equal(confident.length, 3);
  const [first, second] = guideProse({agent: "factor-bot v0.4.2"}, confident);
  assert.match(first, /^factor-bot read the legacy test specs and a successful live run/);
  assert.match(first, /proposes 3 new rules/);
  assert.match(second, /verifies cleanly against the map/);
});

test("no advisory middle: not-highest-confidence is rejected with stated reasoning", () => {
  assert.equal(confidenceOf(proposalEntity("PROP-0035")).confident, true);
  const dupe = confidenceOf(proposalEntity("PROP-0031"));
  assert.equal(dupe.confident, false);
  assert.match(dupe.reasons.join(" "), /repeats the approved rule/);
  assert.match(confidenceOf(proposalEntity("PROP-0043")).reasons.join(" "), /never walked this route/);
  assert.match(confidenceOf(proposalEntity("PROP-0034")).reasons.join(" "), /more than its source/);
  assert.match(confidenceOf(proposalEntity("PROP-0042")).reasons.join(" "), /screen the map has never seen/);
});

test("the yaml diff is the change approving applies", () => {
  const fresh = yamlDiff(proposalEntity("PROP-0041"));
  assert.ok(fresh.every((l) => l.sign === "+"));
  const removal = yamlDiff(proposalEntity("PROP-0052"));
  assert.ok(removal.every((l) => l.sign === "-"));
  const edit = yamlDiff(proposalEntity("PROP-0051"));
  assert.ok(edit.some((l) => l.sign === "-" && l.text.includes("sb/category-grid")));
  assert.ok(edit.some((l) => l.sign === "+" && l.text.includes("sb/store-list")));
  assert.ok(edit.some((l) => l.sign === " " && l.text === "given:"));
  assert.match(yamlFileFor(proposalEntity("PROP-0041").proposal), /^proposals\/tip-prompt.*\.yaml$/);
});

test("next-unjudged wraps and skips the judged", () => {
  const ids = ["a", "b", "c"];
  let state = reviewReduce(initialReview, {type: "judge", id: "b", verdict: "reject"});
  assert.equal(nextUnjudged(state, ids, "a"), "c");
  assert.equal(nextUnjudged(state, ids, "c"), "a");
});

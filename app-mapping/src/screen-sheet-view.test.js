import {test} from "node:test";
import assert from "node:assert/strict";
import {parseQuery, canonicalize, resolveAnswer} from "./query.js";
import {screenOccurrences} from "./screen-sheet-view.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const DE = "?journey=onboarding&container=meals&platform=android&cohort=new&locale=de-DE&market=DE&build=8.112";

function deOnboardingAnswer() {
  const r = resolveAnswer(canonicalize(parseQuery(DE)).query, NOW);
  assert.equal(r.kind, "answer");
  return r.answer;
}

test("overlay screen: one occurrence, one composition, never a base, empty variant union", () => {
  const answer = deOnboardingAnswer();
  const result = screenOccurrences(answer, "ovl/sms-consent#19bd");
  assert.equal(result.occurrences.length, 1);
  assert.equal(result.compositions.length, 1);
  assert.equal(result.isBase, false);
  assert.deepEqual(result.variantUnion, []);
});

test("base screen with two distinct compositions: variant union merges both base steps", () => {
  const answer = deOnboardingAnswer();
  const result = screenOccurrences(answer, "onb/phone#77c1");
  assert.equal(result.occurrences.length, 2);
  assert.equal(result.compositions.length, 2);
  assert.notEqual(result.compositions[0].signature, result.compositions[1].signature);
  assert.equal(result.isBase, true);
  assert.deepEqual(result.variantUnion, ["POPULATED", "ERROR"]);
});

test("same-composition steps collapse to one composition, but occurrences and variant union stay per-step", () => {
  const A = {key: "x/a#1"};
  const answer = {
    steps: [
      {stack: [A], baseScreen: A, variants: ["POPULATED"], occluded: []},
      {stack: [A], baseScreen: A, variants: ["ERROR"], occluded: []},
    ],
  };
  const result = screenOccurrences(answer, "x/a#1");
  assert.equal(result.occurrences.length, 2);
  assert.equal(result.compositions.length, 1);
  assert.deepEqual(result.variantUnion, ["POPULATED", "ERROR"]);
  assert.equal(result.isBase, true);
});

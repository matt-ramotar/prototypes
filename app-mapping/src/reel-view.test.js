import {test} from "node:test";
import assert from "node:assert/strict";
import {parseQuery, canonicalize, resolveAnswer} from "./query.js";
import {groupStepsByPhase} from "./reel-view.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const DE = "?journey=onboarding&container=meals&platform=android&cohort=new&locale=de-DE&market=DE&build=8.112";

test("real fixture: DE onboarding steps are grouped losslessly and in phase order", () => {
  const r = resolveAnswer(canonicalize(parseQuery(DE)).query, NOW);
  assert.equal(r.kind, "answer");
  const answer = r.answer;
  const groups = groupStepsByPhase(answer.steps, answer.journey.phases);

  const total = groups.reduce((sum, g) => sum + g.steps.length, 0);
  assert.equal(total, answer.steps.length);

  for (const g of groups) {
    for (let i = 1; i < g.steps.length; i++)
      assert.ok(g.steps[i].index > g.steps[i - 1].index, `${g.phase}: indexes must be strictly ascending`);
  }

  assert.deepEqual(groups.map((g) => g.phase), answer.journey.phases);
});

test("unknown phases are appended as trailing groups, not dropped", () => {
  const steps = [{baseScreen: {phase: "Launch"}}, {baseScreen: {phase: "Mystery"}}];
  const groups = groupStepsByPhase(steps, ["Launch", "Home"]);
  assert.deepEqual(groups.map((g) => g.phase), ["Launch", "Mystery"]);
  assert.equal(groups.reduce((sum, g) => sum + g.steps.length, 0), 2);
});

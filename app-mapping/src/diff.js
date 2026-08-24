import {SCREENS} from "./fixtures.js";

function nodeIndex(answer) {
  // key → {variants: Set, stacks: Set<serialized>, order: first step index}
  const idx = new Map();
  answer.steps.forEach((step, i) => {
    for (const node of step.stack) {
      if (!idx.has(node.key))
        idx.set(node.key, {variants: new Set(), stacks: new Set(), order: i});
      const e = idx.get(node.key);
      e.stacks.add(step.stack.map((n) => n.key).join(" / "));
      if (node.key === step.baseScreen.key) step.variants.forEach((v) => e.variants.add(v));
    }
  });
  return idx;
}

function positionNote(answer, key) {
  const screen = SCREENS[key];
  const i = answer.steps.findIndex((s) => s.stack.some((n) => n.key === key));
  if (i > 0) {
    const prev = answer.steps[i - 1].baseScreen;
    return `Appears after ${prev.label ?? prev.derivedLabel}`;
  }
  return `First screen of ${screen.phase} in this lane`;
}

const setsEqual = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export function computeDiff(answerA, answerB) {
  const ia = nodeIndex(answerA), ib = nodeIndex(answerB);
  const onlyA = [], onlyB = [], changed = [], shared = [];

  for (const [key, ea] of ia) {
    if (!ib.has(key)) { onlyA.push({key, screen: SCREENS[key], note: positionNote(answerA, key)}); continue; }
    const eb = ib.get(key);
    const kinds = [];
    const details = [];
    if (!setsEqual(ea.variants, eb.variants)) {
      kinds.push("variant-set");
      details.push(`variant set: A observes ${[...ea.variants].join(" · ") || "—"}, B observes ${[...eb.variants].join(" · ") || "—"}`);
    }
    if (!setsEqual(ea.stacks, eb.stacks)) {
      kinds.push("stack");
      details.push("stack composition differs between lanes");
    }
    if (kinds.length > 0)
      changed.push({key, screen: SCREENS[key], kinds, detail: details.join("; "),
        basis: "frozen-key", confidence: "high"});
    else shared.push({key, screen: SCREENS[key]});
  }
  for (const [key] of ib)
    if (!ia.has(key)) onlyB.push({key, screen: SCREENS[key], note: positionNote(answerB, key)});

  const phaseOrder = answerA.journey.phases;
  const entries = [
    ...onlyA.map((e) => ({type: "only-a", ...e})),
    ...onlyB.map((e) => ({type: "only-b", ...e})),
    ...changed.map((e) => ({type: "changed", ...e})),
  ];
  const byPhase = phaseOrder
    .map((phase) => ({phase, entries: entries.filter((e) => e.screen.phase === phase)}))
    .filter((p) => p.entries.length > 0);

  return {onlyA, onlyB, changed, shared, byPhase};
}

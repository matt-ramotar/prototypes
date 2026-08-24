// Derives everything the screen detail Sheet needs to render for one screen key out of
// an answer's walk steps: every occurrence, the distinct stack compositions among them
// (first-seen order, deduped by serialized stack signature), the union of variants across
// occurrences where the screen is the base, and whether the screen is ever a base at all.

export function screenOccurrences(answer, screenKey) {
  const occurrences = answer.steps.filter((s) => s.stack.some((n) => n.key === screenKey));

  const compositions = [];
  const seenCompositions = new Set();
  for (const step of occurrences) {
    const signature = step.stack.map((n) => n.key).join(" / ");
    if (!seenCompositions.has(signature)) {
      seenCompositions.add(signature);
      compositions.push({signature, step});
    }
  }

  const baseOccurrences = occurrences.filter((s) => s.baseScreen.key === screenKey);
  const variantUnion = [...new Set(baseOccurrences.flatMap((s) => s.variants))];
  const isBase = baseOccurrences.length > 0;

  return {occurrences, compositions, variantUnion, isBase};
}

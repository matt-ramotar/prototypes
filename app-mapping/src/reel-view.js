// Groups a walk's steps by journey phase, preserving lossless coverage of every step
// even when a step's phase isn't one of the journey's declared phases.

export function groupStepsByPhase(steps, phases) {
  const enriched = steps.map((s, i) => ({...s, index: i}));

  const unknownPhases = [];
  for (const s of enriched) {
    const phase = s.baseScreen.phase;
    if (!phases.includes(phase) && !unknownPhases.includes(phase)) unknownPhases.push(phase);
  }

  return [...phases, ...unknownPhases]
    .map((phase) => ({phase, steps: enriched.filter((s) => s.baseScreen.phase === phase)}))
    .filter((p) => p.steps.length > 0);
}

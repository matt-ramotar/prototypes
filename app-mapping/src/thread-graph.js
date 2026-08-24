// The screen graph behind the thread map.
//
// Two graphs are laid over each other here and they are NOT the same graph:
//
//   declared  — EDGES, the transitions the app is known to offer. Branchy: this is
//               where forks and merges live.
//   observed  — the transitions a crawl actually took. A walk is a sequence, so on
//               its own it is always a line.
//
// Keeping them separate is the whole point. A reader must be able to see a branch
// that exists but was not taken under the mounted Given, and a transition that was
// taken but is not declared. Collapsing the two would hide both.

import {BUILDS, EDGES, JOURNEYS, LANES, OBSERVATIONS, SCREENS} from "./fixtures.js";

/**
 * Four states, deliberately the same vocabulary the Atlas already uses:
 *   fresh     observed under this Given, at the selected build
 *   stale     observed under this Given, but only on an older build
 *   elsewhere observed somewhere in the map, never under this Given
 *   never     declared, never observed anywhere
 */
export const GRAPH_STATES = ["fresh", "stale", "elsewhere", "never"];

const edgeId = (from, to) => `${from}>${to}`;

export function laneOf(given) {
  if (!given?.container || !given?.platform) return null;
  return LANES.find((l) =>
    l.container.toLowerCase() === given.container.toLowerCase() &&
    l.platform.toLowerCase() === given.platform.toLowerCase()) ?? null;
}

/**
 * Transitions a set of observations actually took. Stacks are top-first, so the
 * thing the user moved *from* is stack[0] — using the base would report a
 * self-transition every time an overlay opened over the screen beneath it.
 * Stack adjacency (base → the overlay resting on it) is a transition too: it is
 * the only record that some overlays exist at all.
 */
export function observedTransitions(observations) {
  const out = new Map();
  const add = (from, to, ob) => {
    if (from === to) return;
    const id = edgeId(from, to);
    if (!out.has(id)) out.set(id, {id, from, to, runs: new Set(), builds: new Set()});
    out.get(id).runs.add(ob.runId);
    out.get(id).builds.add(ob.build);
  };
  for (const ob of observations) {
    for (let i = 0; i < ob.walk.length - 1; i++) {
      add(ob.walk[i].stack[0], ob.walk[i + 1].stack[0], ob);
    }
    for (const step of ob.walk) {
      for (let i = step.stack.length - 1; i > 0; i--) add(step.stack[i], step.stack[i - 1], ob);
    }
  }
  return out;
}

const keysIn = (observations) =>
  new Set(observations.flatMap((o) => o.walk.flatMap((w) => w.stack)));

function stateFor(inBuild, inGiven, anywhere) {
  if (inBuild) return "fresh";
  if (inGiven) return "stale";
  if (anywhere) return "elsewhere";
  return "never";
}

/**
 * The graph for a set of journeys under one Given. Pure: `now` is passed in and
 * nothing here reads the clock.
 */
export function threadGraph(journeyIds, given, now) {
  const journeys = JOURNEYS.filter((j) => journeyIds.includes(j.id));
  const lane = laneOf(given);
  const scope = new Set(Object.values(SCREENS)
    .filter((s) => journeyIds.includes(s.journeyId)).map((s) => s.key));

  const inGiven = lane
    ? OBSERVATIONS.filter((o) => o.lane === lane.id && o.cohort === given.cohort &&
      o.locale === given.locale && o.market === given.market)
    : [];
  const atBuild = inGiven.filter((o) => o.build === given.build);

  const seenAtBuild = keysIn(atBuild);
  const seenInGiven = keysIn(inGiven);
  const seenAnywhere = keysIn(OBSERVATIONS);

  const transAtBuild = observedTransitions(atBuild);
  const transInGiven = observedTransitions(inGiven);
  const transAnywhere = observedTransitions(OBSERVATIONS);

  const nodes = [...scope].sort().map((key) => {
    const screen = SCREENS[key];
    const carrying = OBSERVATIONS.filter((o) => o.walk.some((w) => w.stack.includes(key)));
    const freshest = [...carrying].sort((a, b) =>
      BUILDS.indexOf(b.build) - BUILDS.indexOf(a.build))[0] ?? null;
    return {
      key,
      screen,
      journeyId: screen.journeyId,
      phase: screen.phase,
      kind: screen.kind,
      state: stateFor(seenAtBuild.has(key), seenInGiven.has(key), seenAnywhere.has(key)),
      lanes: [...new Set(carrying.map((o) => o.lane))].sort(),
      markets: [...new Set(carrying.map((o) => o.market))].sort(),
      latestBuild: freshest?.build ?? null,
      ageDays: freshest ? Math.floor((now - new Date(freshest.observedAt)) / 86400000) : null,
    };
  });

  const byId = new Map();
  for (const e of EDGES) {
    if (!scope.has(e.from) || !scope.has(e.to)) continue;
    const id = edgeId(e.from, e.to);
    byId.set(id, {
      id, from: e.from, to: e.to, role: e.role, traversable: e.traversable,
      declared: true,
      state: stateFor(transAtBuild.has(id), transInGiven.has(id), transAnywhere.has(id)),
      runs: [...(transInGiven.get(id)?.runs ?? [])].sort(),
    });
  }
  for (const [id, t] of transAnywhere) {
    if (byId.has(id) || !scope.has(t.from) || !scope.has(t.to)) continue;
    byId.set(id, {
      id, from: t.from, to: t.to, role: null, traversable: true,
      declared: false,
      state: stateFor(transAtBuild.has(id), transInGiven.has(id), true),
      runs: [...(transInGiven.get(id)?.runs ?? [])].sort(),
    });
  }
  const edges = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

  return {
    journeys,
    lane,
    nodes,
    edges,
    counts: {
      nodes: nodes.length,
      declaredEdges: edges.filter((e) => e.declared).length,
      undeclaredEdges: edges.filter((e) => !e.declared).length,
      byNodeState: Object.fromEntries(GRAPH_STATES.map((s) =>
        [s, nodes.filter((n) => n.state === s).length])),
    },
  };
}

/**
 * Declared root→leaf paths, each annotated with how much of it this Given walked.
 * Undeclared observed transitions are reported separately rather than being folded
 * in — a transition the crawler took is not evidence that the app declares it.
 */
export function threads(graph) {
  const declared = graph.edges.filter((e) => e.declared);
  const succ = new Map(graph.nodes.map((n) => [n.key, []]));
  const indeg = new Map(graph.nodes.map((n) => [n.key, 0]));
  for (const e of declared) {
    succ.get(e.from).push(e.to);
    indeg.set(e.to, indeg.get(e.to) + 1);
  }
  for (const [, list] of succ) list.sort();

  const stateOf = new Map(graph.edges.map((e) => [e.id, e.state]));
  const out = [];
  const roots = graph.nodes.map((n) => n.key)
    .filter((k) => indeg.get(k) === 0 && succ.get(k).length > 0).sort();

  const walk = (key, path) => {
    const next = succ.get(key);
    if (next.length === 0) {
      const keys = [...path, key];
      const legs = keys.slice(0, -1).map((k, i) => stateOf.get(edgeId(k, keys[i + 1])));
      const walked = legs.filter((s) => s === "fresh" || s === "stale").length;
      out.push({
        id: keys.join(">"),
        journeyId: SCREENS[key].journeyId,
        keys,
        legs,
        walkedLegs: walked,
        state: walked === legs.length ? "walked" : walked === 0 ? "unwalked" : "partial",
      });
      return;
    }
    for (const n of next) walk(n, [...path, key]);
  };
  for (const r of roots) walk(r, []);

  const undeclared = graph.edges.filter((e) => !e.declared)
    .map((e) => ({...e, journeyId: SCREENS[e.from].journeyId}));

  return {declared: out, undeclared};
}

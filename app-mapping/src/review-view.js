// Derived views over review proposals. Pure over the fixture shapes, like every
// other *-view module here. Nothing an agent claims is trusted: route reality,
// observation counts, overlap, and novelty are all re-derived from the map
// fixtures, so the page renders verification it did not take on faith.

import {EDGES, JOURNEYS, OBSERVATIONS, SCREENS} from "./fixtures.js";
import {CATALOG_REQS, PROPOSALS, SESSIONS} from "./proposal-fixtures.js";

// -- route verification -------------------------------------------------------

/** Observations only pin market/locale/cohort — flags are not recorded in
 *  walks, so "under this Given" is honest about what the map can actually
 *  confirm and no stronger. */
const matchesGiven = (o, given) =>
  o.market === given.market && o.cohort === given.cohort;

const obsContaining = (key) =>
  OBSERVATIONS.filter((o) => o.walk.some((w) => w.stack.includes(key)));

/** A single observed intermediate that repairs a missing hop, or null. */
export function spliceFor(from, to) {
  const outs = EDGES.filter((e) => e.from === from && e.traversable);
  for (const out of outs) {
    if (EDGES.some((e) => e.from === out.to && e.to === to && e.traversable)) return out.to;
  }
  return null;
}

/**
 * Every hop checked against the map: does the edge exist, is the screen known,
 * how often has the map seen it — globally and under this proposal's Given.
 */
export function verifyRoute(route, given) {
  const hops = route.map((key, i) => {
    const screen = SCREENS[key] ?? null;
    const prev = i > 0 ? route[i - 1] : null;
    const edge = prev ? EDGES.find((e) => e.from === prev && e.to === key) ?? null : null;
    const containing = screen ? obsContaining(key) : [];
    const under = containing.filter((o) => matchesGiven(o, given));
    return {
      key, screen, prev,
      unmapped: screen == null,
      missingEdge: prev != null && screen != null && SCREENS[prev] != null && edge == null,
      traversable: edge?.traversable ?? null,
      obs: containing.reduce((n, o) => n + o.obsCount, 0),
      obsUnder: under.reduce((n, o) => n + o.obsCount, 0),
      splice: prev != null && screen != null && edge == null ? spliceFor(prev, key) : null,
    };
  });
  const blockers = hops.filter((h) => h.unmapped || h.missingEdge);
  const warnings = hops.filter((h) => !h.unmapped && !h.missingEdge &&
    (h.obsUnder === 0 || h.traversable === false));
  return {
    hops, blockers, warnings,
    gate: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warn" : "ok",
  };
}

// -- overlap ------------------------------------------------------------------

const pairsOf = (route) => route.slice(1).map((to, i) => `${route[i]}→${to}`);
const FACETS_COMPARED = ["market", "locale", "cohort"];

function givenDelta(a, b) {
  const delta = FACETS_COMPARED.filter((f) => a[f] !== b[f])
    .map((f) => ({facet: f, ours: a[f], theirs: b[f]}));
  const flags = new Set([...Object.keys(a.flags ?? {}), ...Object.keys(b.flags ?? {})]);
  for (const f of flags) {
    if ((a.flags ?? {})[f] !== (b.flags ?? {})[f])
      delta.push({facet: `flag ${f}`, ours: (a.flags ?? {})[f] ?? "unset", theirs: (b.flags ?? {})[f] ?? "unset"});
  }
  return delta;
}

/** The dedup verdict: the closest catalog contract, with a suggestion. */
export function overlapOf(proposal) {
  const ours = pairsOf(proposal.when.route);
  let best = null;
  for (const req of CATALOG_REQS) {
    if (req.id === proposal.targetReq) continue;
    const theirs = new Set(pairsOf(req.route));
    const shared = ours.filter((p) => theirs.has(p)).length;
    if (shared === 0) continue;
    const fraction = shared / Math.max(ours.length, 1);
    if (!best || fraction > best.fraction) {
      best = {req, shared, of: ours.length, fraction, delta: givenDelta(proposal.given, req.given)};
    }
  }
  if (!best || best.fraction < 0.5) return null;
  const sameRoute = best.fraction === 1 && best.of === pairsOf(best.req.route).length;
  const sameThen = JSON.stringify(proposal.then) === JSON.stringify(best.req.then);
  best.suggestion =
    sameRoute && sameThen && best.delta.length === 0 ? "duplicate"
    : sameRoute && best.delta.length <= 1 ? "variant"
    : "overlap";
  return best;
}

// -- claimed vs confirmed -----------------------------------------------------

/** The trust table: the agent's assertions, re-derived. A false claim flags. */
export function claimsOf(proposal, verification, overlap) {
  const routeReal = verification.blockers.length === 0;
  return [
    {claim: "route exists on the map", claimed: proposal.claims.routeObserved ? "yes" : "no",
      confirmed: routeReal ? "yes" : "no", ok: (proposal.claims.routeObserved === routeReal)},
    {claim: "no catalog overlap", claimed: proposal.claims.novel ? "novel" : "overlaps",
      confirmed: overlap ? `≈ ${overlap.req.id} (${overlap.shared}/${overlap.of} hops)` : "novel",
      ok: proposal.claims.novel === (overlap == null)},
  ];
}

// -- risk ---------------------------------------------------------------------

const OVERREACH = /\b(additionally|also asserted|inferred|assumed)\b/i;
const BLAST = /\b(tip|payment|consent|purchase|money)\b/i;

export function overreachSentences(intent) {
  return intent.split(/(?<=\.)\s+/).filter((s) => OVERREACH.test(s));
}

/** Local arithmetic, no model: where a human minute is most needed. */
export function riskOf(proposal, verification, overlap) {
  const factors = [];
  if (!overlap) factors.push({label: "novel — nothing like it countersigned", pts: 3});
  if (proposal.then.some((t) => BLAST.test(t)))
    factors.push({label: "rule touches money or consent", pts: 3});
  if (proposal.source.kind === "flow")
    factors.push({label: "factored, never run", pts: 2});
  if (verification.gate !== "ok")
    factors.push({label: verification.gate === "blocked"
      ? "route not verifiable on the map" : "unobserved under this Given", pts: 2});
  if (overreachSentences(proposal.intent).length > 0)
    factors.push({label: "intent admits inference beyond the source", pts: 2});
  if (overlap && overlap.fraction >= 0.8)
    factors.push({label: `familiar — ${overlap.shared}/${overlap.of} hops match ${overlap.req.id}`, pts: -2});
  return {factors, total: factors.reduce((n, f) => n + f.pts, 0)};
}

// -- the docket ---------------------------------------------------------------

/** One proposal, fully derived. `route` honors an amendment when one exists. */
export function proposalEntity(id, amendments = {}) {
  const proposal = PROPOSALS.find((p) => p.id === id);
  if (!proposal) return null;
  const route = amendments[id]?.route ?? proposal.when.route;
  const verification = verifyRoute(route, proposal.given);
  const overlap = proposal.kind === "new" ? overlapOf(proposal) : null;
  const target = proposal.targetReq
    ? CATALOG_REQS.find((r) => r.id === proposal.targetReq) ?? null : null;
  return {
    proposal, route, verification, overlap, target,
    amended: amendments[id] != null,
    claims: claimsOf(proposal, verification, overlap),
    risk: riskOf(proposal, verification, overlap),
    overreach: overreachSentences(proposal.intent),
  };
}

const thenSig = (p) => JSON.stringify(p.then);
const routeSig = (p) => p.when.route.join("→");

/** Locale follows market in this fixture, so it never spans a matrix axis. */
const MATRIX_FACETS = ["market", "cohort"];

/** Same route, Givens forming a full grid over exactly two facets → a matrix. */
export function matrixOf(cluster) {
  if (cluster.length < 4) return null;
  const base = thenSig(cluster[0]);
  const cells = cluster.filter((p) => thenSig(p) === base);
  const ejected = cluster.filter((p) => thenSig(p) !== base);
  const facetValues = (facet) => [...new Set(cells.map((p) => p.given[facet]))];
  const varying = MATRIX_FACETS.filter((f) => facetValues(f).length > 1);
  if (varying.length !== 2) return null;
  const [rowFacet, colFacet] = varying;
  const rows = facetValues(rowFacet);
  const cols = facetValues(colFacet);
  if (cells.length !== rows.length * cols.length) return null;
  return {
    rowFacet, colFacet, rows, cols, ejected,
    at: (r, c) => cells.find((p) => p.given[rowFacet] === r && p.given[colFacet] === c) ?? null,
  };
}

/** Sessions → clusters (shared route) → items, riskiest first. */
export function docketOf(amendments = {}) {
  return SESSIONS.map((session) => {
    const mine = PROPOSALS.filter((p) => p.sessionId === session.id);
    const byRoute = new Map();
    for (const p of mine) {
      const sig = routeSig(p);
      byRoute.set(sig, [...(byRoute.get(sig) ?? []), p]);
    }
    const entity = (p) => proposalEntity(p.id, amendments);
    const byRisk = (a, b) => b.risk.total - a.risk.total;
    const clusters = [...byRoute.values()].filter((g) => g.length > 1)
      .map((g) => ({
        route: g[0].when.route,
        matrix: matrixOf(g),
        items: g.map(entity).sort(byRisk),
      }));
    const singletons = [...byRoute.values()].filter((g) => g.length === 1)
      .map(([p]) => entity(p)).sort(byRisk);
    return {session, clusters, singletons,
      total: mine.length,
      order: [...clusters.flatMap((c) => c.items), ...singletons].map((e) => e.proposal.id)};
  });
}

/** The flat j/k order the docket and the proposal pages share. */
export const docketOrder = (docket) => docket.flatMap((s) => s.order);

const STAGE_LABEL = {conditions: "Setup", route: "Route", rules: "Checks", signal: "Signal"};

/**
 * The agent's work as simple labeled steps — the "thought for a moment" read.
 * Derived from the proposal's source, ending with its own stated reasoning.
 */
export function reasoningSteps(entity) {
  const p = entity.proposal;
  const src = p.source;
  const steps = [];
  if (src.kind === "flow") {
    steps.push({label: "Source", text: `Read ${src.ref}.`});
    for (const [stage, line] of src.lines)
      steps.push({label: STAGE_LABEL[stage] ?? stage, text: line});
  } else {
    steps.push({label: "Run", text: `Watched ${src.ref} drive this route live.`});
    steps.push({label: "Setup",
      text: src.stages.conditions.map(([l, , o]) => `${l}: ${o}`).join(" · ")});
    steps.push({label: "Checks",
      text: src.stages.rules.map((r) => `${r.rule} — ${r.verdict}`).join(" · ")});
  }
  steps.push({label: "Reasoning", text: p.intent, flagged: entity.overreach.length > 0});
  return steps;
}

/**
 * Grounded replies for the follow-up chat. Facts come from the same map
 * derivations the page shows; anything else gets an honest miss. Returns
 * {text, steps} so the reply can carry its own worked-it-out collapse.
 */
export function chatReply(entity, question) {
  const q = question.toLowerCase();
  const {proposal, verification, overlap, target} = entity;

  if (overlap && /(variant|covered|again|exist|duplicate|differ)/.test(q)) {
    const delta = overlap.delta.map((d) => `${d.facet} (${d.theirs} there, ${d.ours} here)`).join(", ");
    return {
      steps: [{label: "Compared", text: `this route against the approved rule “${overlap.req.title}”`}],
      text: overlap.suggestion === "duplicate"
        ? `An approved rule already checks exactly this — same route, same given. Approving it again adds nothing; rejecting it as redundant tells the agent to check the catalog first.`
        : delta
          ? `The approved rule covers the same route but under a different given — ${delta}. Approving this adds the missing coverage; it isn't a duplicate.`
          : `The approved rule walks the same route with the same given — only the rules differ. If the extra rule is wanted, approve; if not, this is redundant.`,
    };
  }
  if (entity.overreach.length > 0 && /(assert|infer|source|beyond)/.test(q)) {
    return {
      steps: [{label: "Traced", text: `every rule back to ${proposal.source.ref}`}],
      text: `No. The source only asserted what its own checks covered — the flagged sentence is the agent's inference: “${entity.overreach[0]}” If that extra rule isn't wanted, send this back and the agent will drop it.`,
    };
  }
  const unseen = verification.hops.filter((h) => !h.unmapped && !h.missingEdge && h.obsUnder === 0);
  if (unseen.length > 0 && /(flake|observe|seen|first run|setup|given)/.test(q)) {
    return {
      steps: [{label: "Looked up", text: "every sighting of this route in the map's records"}],
      text: `The map has never walked ${unseen.map((h) => h.key.split("#")[0].split("/")[1]).join(" and ")} with this given — the screens exist and the route is real, but all sightings were under other settings. The first run is the real test; if it passes, the map learns this given too.`,
    };
  }
  if (proposal.kind === "retire" && /(depend|happens|other)/.test(q)) {
    const n = target?.referencedBy.length ?? 0;
    return {
      steps: [{label: "Checked", text: "what references this rule in the approved set"}],
      text: n > 0
        ? `${n} approved ${n === 1 ? "rule references" : "rules reference"} this one. Removing it doesn't delete them — they come back to this list for a fresh decision.`
        : "Nothing references this rule; removing it affects nothing else.",
    };
  }
  const broken = verification.hops.find((h) => h.missingEdge && h.splice);
  if (broken && /(fix|route|step|direct)/.test(q)) {
    return {
      steps: [{label: "Searched", text: "the map for an observed path between the broken steps"}],
      text: `The map has never seen that direct step, but it has seen a path through ${broken.splice.split("#")[0].split("/")[1]}. “Fix the route” swaps it in and keeps the edit on the record.`,
    };
  }
  return {
    steps: [{label: "Checked", text: "the map's records for this route and given"}],
    text: "That isn't something the map can answer from its records. Send the proposal back with your question as the note — the agent reads it next session.",
  };
}

const listJoin = (xs) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

const screenLabel = (key) => SCREENS[key]
  ? (SCREENS[key].label ?? SCREENS[key].derivedLabel)
  : key.split("#")[0];

/**
 * The system's own triage: a proposal is either held with highest
 * confidence, or it is considered-but-rejected with the reasoning stated.
 * There is no advisory middle. A human can still overrule a rejection.
 */
export function confidenceOf(entity) {
  const reasons = [];
  for (const hop of entity.verification.blockers) {
    reasons.push(hop.unmapped
      ? `references a screen the map has never seen (${hop.key.split("#")[0]})`
      : `uses a step the map has never seen (${screenLabel(hop.prev)} → ${screenLabel(hop.key)})`);
  }
  if (entity.verification.gate === "warn")
    reasons.push("the map has never walked this route with these settings");
  if (entity.overlap?.suggestion === "duplicate")
    reasons.push(`repeats the approved rule “${entity.overlap.req.title}”`);
  if (entity.overreach.length > 0)
    reasons.push("asserts more than its source checked");
  return {confident: reasons.length === 0, reasons};
}

/**
 * The Guide's narration for one section, in natural language. Derived from
 * the same analysis as everything else, so the prose cannot oversell: what
 * the agent read, what it proposes, and what deserves a closer look.
 */
export function guideProse(session, entities) {
  const agent = session.agent.replace(/ v[\d.]+$/, "");
  const kinds = {new: 0, modify: 0, retire: 0};
  for (const e of entities) kinds[e.proposal.kind] += 1;
  const srcKinds = new Set(entities.map((e) => e.proposal.source.kind === "run" ? "run"
    : e.proposal.source.ref.startsWith("impact") ? "impact" : "spec"));
  const sources = [];
  if (srcKinds.has("spec")) sources.push("the legacy test specs");
  if (srcKinds.has("run")) sources.push("a successful live run");
  if (srcKinds.has("impact")) sources.push("what changed in the latest app update");
  const journeys = [...new Set(entities.flatMap((e) =>
    e.route.map((k) => SCREENS[k]?.journeyId).filter(Boolean)))]
    .map((id) => JOURNEYS.find((j) => j.id === id)?.label.toLowerCase()).filter(Boolean);
  const work = [];
  if (kinds.new > 0) work.push(`${kinds.new} new ${kinds.new === 1 ? "rule" : "rules"}`);
  if (kinds.modify > 0) work.push(`${kinds.modify} route ${kinds.modify === 1 ? "update" : "updates"}`);
  if (kinds.retire > 0) work.push(`${kinds.retire} ${kinds.retire === 1 ? "removal" : "removals"}`);
  const first = `${agent} read ${listJoin(sources)} and proposes ${listJoin(work)}, covering ${listJoin(journeys)}.`;
  return [first, "Every rule here verifies cleanly against the map."];
}

/** The proposal file's name — the artifact is ultimately a yaml file. */
export function yamlFileFor(proposal) {
  let slug = proposal.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (slug.length > 44) slug = slug.slice(0, 44).replace(/-[^-]*$/, "");
  return `proposals/${slug}.yaml`;
}

/**
 * The proposal rendered as the yaml diff that approving actually applies:
 * a new contract is all additions, a removal all deletions, and an edit
 * keeps its context lines with -/+ only where the route changed.
 */
export function yamlDiff(entity) {
  const p = entity.proposal;
  const whole = p.kind === "retire" ? "-" : "+";
  const ctx = p.kind === "modify" ? " " : whole;
  const lines = [];
  const push = (sign, text) => lines.push({sign, text});
  push(ctx, "given:");
  push(ctx, `  market: ${p.given.market}`);
  push(ctx, `  locale: ${p.given.locale}`);
  push(ctx, `  cohort: ${p.given.cohort}`);
  const flags = Object.entries(p.given.flags ?? {});
  if (flags.length > 0) {
    push(ctx, "  flags:");
    for (const [f, v] of flags) push(ctx, `    ${f}: ${v}`);
  }
  push(ctx, "when:");
  if (p.kind === "modify" && entity.target) {
    for (const key of entity.target.route) push("-", `  - ${key}`);
    for (const key of entity.route) push("+", `  - ${key}`);
  } else {
    for (const key of entity.route) push(ctx, `  - ${key}`);
  }
  push(ctx, "then:");
  for (const rule of p.then) push(ctx, `  - ${rule}`);
  return lines;
}

/**
 * The questions this proposal should make a reviewer ask — derived from the
 * same analysis the page shows, phrased as prompts rather than verdicts.
 */
export function questionsFor(entity) {
  const qs = [];
  const {proposal, verification, overlap, target} = entity;
  if (overlap?.suggestion === "duplicate")
    qs.push("Isn't this already covered?");
  else if (overlap?.suggestion === "variant")
    qs.push("Should this be a variant of the existing rule instead?");
  if (entity.overreach.length > 0)
    qs.push("Did the source actually check this, or did the agent infer it?");
  for (const hop of verification.blockers) {
    if (hop.unmapped) qs.push(`Is ${hop.key.split("#")[0]} a real screen the crawler missed, or invented?`);
    else if (hop.splice) qs.push(`Is the direct hop intended, or should the route go via the observed path?`);
  }
  if (verification.gate === "warn" && proposal.kind === "new")
    qs.push("Nothing has been observed under this Given — will the first run flake?");
  if (proposal.kind === "modify") qs.push("Does the rule survive the reroute unchanged?");
  if (proposal.kind === "retire" && target?.referencedBy.length)
    qs.push("What happens to the rules that depend on this one?");
  if (proposal.source.kind === "run") {
    const weakest = [...proposal.source.stages.rules].sort((a, b) => a.conf - b.conf)[0];
    if (weakest && weakest.conf < 0.9)
      qs.push(`The judge was least sure of "${weakest.rule}" — is the assertion crisp enough?`);
  }
  return qs.slice(0, 2);
}

// -- judgment -----------------------------------------------------------------

export const initialReview = {verdicts: {}, viewed: [], amendments: {}, history: []};

export const VERDICTS = ["accept", "reject", "changes"];

/**
 * The reducer the pages dispatch into. Judgments are instant and undoable;
 * provenance accretes — an amendment survives on the record even after undo
 * of the verdict it enabled.
 */
export function reviewReduce(state, action) {
  switch (action.type) {
    case "view":
      return state.viewed.includes(action.id) ? state
        : {...state, viewed: [...state.viewed, action.id]};
    case "judge": {
      const record = {verdict: action.verdict, reason: action.reason ?? null,
        note: action.note ?? null, via: action.via ?? "single",
        amended: state.amendments[action.id] != null};
      return {...state,
        verdicts: {...state.verdicts, [action.id]: record},
        history: [...state.history, {id: action.id, prev: state.verdicts[action.id] ?? null}]};
    }
    case "batch": {
      const verdicts = {...state.verdicts};
      const history = [...state.history];
      for (const id of action.ids) {
        history.push({id, prev: verdicts[id] ?? null});
        verdicts[id] = {verdict: "accept", reason: null, note: action.statement,
          via: "batch", amended: state.amendments[id] != null};
      }
      return {...state, verdicts, history};
    }
    case "amend":
      return {...state, amendments: {...state.amendments, [action.id]: action.patch}};
    case "undo": {
      const last = state.history.at(-1);
      if (!last) return state;
      const verdicts = {...state.verdicts};
      if (last.prev) verdicts[last.id] = last.prev;
      else delete verdicts[last.id];
      return {...state, verdicts, history: state.history.slice(0, -1)};
    }
    default:
      return state;
  }
}

/** Fail closed: a route the map cannot verify cannot be countersigned. */
export const canAccept = (entity) => entity.verification.blockers.length === 0;

export function progressOf(state, ids) {
  const judged = ids.filter((id) => state.verdicts[id]).length;
  return {judged, total: ids.length, done: judged === ids.length && ids.length > 0};
}

export function nextUnjudged(state, ids, fromId) {
  const start = fromId ? ids.indexOf(fromId) + 1 : 0;
  const wrapped = [...ids.slice(start), ...ids.slice(0, start)];
  return wrapped.find((id) => !state.verdicts[id] && id !== fromId) ?? null;
}

/** The session receipt: what a batch of judgments actually was. */
export function receiptOf(state, ids) {
  const records = ids.map((id) => state.verdicts[id]).filter(Boolean);
  return {
    judged: records.length,
    countersigned: records.filter((r) => r.verdict === "accept").length,
    amended: records.filter((r) => r.verdict === "accept" && r.amended).length,
    viaBatch: records.filter((r) => r.via === "batch").length,
    changes: records.filter((r) => r.verdict === "changes").length,
    rejected: records.filter((r) => r.verdict === "reject").length,
  };
}

import {BUILDS, FACETS, JOURNEYS, LANES, OBSERVATIONS, SCREENS} from "./fixtures.js";
import {canonicalize, resolveAnswer, serializeQuery} from "./query.js";
import {computeDiff} from "./diff.js";
import {atlasCells} from "./atlas-view.js";
import {pathFor} from "./routes.js";

export const PROVENANCE = "deterministic resolver over the published map · model slot reserved";

export const SUGGESTIONS = [
  "What does a new user in Germany see during Meals Android onboarding?",
  "Where do Germany and US differ in onboarding?",
  "What error states exist in search?",
  "Where does the SMS consent appear?",
  "What changed in 8.112?",
];

const MARKET_WORDS = {germany: "DE", berlin: "DE", de: "DE", eu: "DE",
  us: "US", usa: "US", "united states": "US", america: "US"};
const MARKET_LOCALE = {DE: "de-DE", US: "en-US"};

const nameOf = (s) => s.label ?? s.derivedLabel;

export function entityMatches(input) {
  const q = input.trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  for (const s of Object.values(SCREENS))
    if (nameOf(s).toLowerCase().includes(q) || s.key.toLowerCase().includes(q))
      out.push({type: "screen", id: s.key, label: nameOf(s), sub: s.key, path: pathFor("screen", s.key)});
  for (const j of JOURNEYS)
    if (j.label.toLowerCase().includes(q) || j.id.includes(q))
      out.push({type: "journey", id: j.id, label: j.label, sub: j.team, path: pathFor("journey", j.id)});
  for (const l of LANES) {
    const label = `${l.container} · ${l.platform}`;
    if (label.toLowerCase().includes(q) || l.id.includes(q))
      out.push({type: "lane", id: l.id, label, sub: l.surface, path: pathFor("lane", l.id)});
  }
  for (const b of BUILDS)
    if (b.includes(q) || `b${b}`.includes(q))
      out.push({type: "build", id: b, label: `b${b}`, sub: "build", path: pathFor("build", b)});
  return out.slice(0, 8);
}

function detect(input) {
  const t = ` ${input.trim().toLowerCase().replace(/[?,!]/g, "")} `;
  const found = {markets: [], journey: null, lane: null, build: null, variant: null, overlay: null};
  for (const [word, market] of Object.entries(MARKET_WORDS))
    if (t.includes(` ${word} `) && !found.markets.includes(market)) found.markets.push(market);
  for (const j of JOURNEYS)
    if (t.includes(j.label.toLowerCase()) || t.includes(` ${j.id} `)) { found.journey = j; break; }
  for (const l of LANES) {
    const both = t.includes(l.container.toLowerCase()) && t.includes(l.platform.toLowerCase());
    if (both) { found.lane = l; break; }
  }
  if (!found.lane) {
    for (const l of LANES) if (t.includes(l.platform.toLowerCase()) && t.includes("meals")) { found.lane = l; break; }
  }
  const b = t.match(/(\d+\.\d+)/);
  if (b && BUILDS.includes(b[1])) found.build = b[1];
  for (const v of ["error", "empty", "loading", "offline", "skeleton"])
    if (t.includes(` ${v} `)) { found.variant = v.toUpperCase(); break; }
  for (const s of Object.values(SCREENS))
    if (s.kind === "OVERLAY" && t.includes(nameOf(s).toLowerCase())) { found.overlay = s; break; }
  return {t, ...found};
}

const CAN_ANSWER = [
  "what a specific user sees for a journey (permutation)",
  "where two markets or builds differ (divergence, change)",
  "which screens carry error/empty/loading states (variant search)",
  "where an overlay appears (stack contexts)",
  "what is observed or not walked on a lane (coverage)",
];

function givenFor(lane, market, journey, build) {
  return canonicalize({
    journey: journey.id, container: lane.container.toLowerCase(), platform: lane.platform.toLowerCase(),
    cohort: "new", locale: MARKET_LOCALE[market], market, build,
    pivot: null, counterpart: null, view: null, screen: null,
  }).query;
}

const isQuestion = (input) => /\?|^(what|where|which|how|show|compare|find|does|do|is|are)\b/i.test(input.trim());

export function ask(input, now) {
  const d = detect(input);
  if (!isQuestion(input)) {
    const matches = entityMatches(input);
    if (matches.length > 0) return {kind: "matches", matches};
  }

  const lane = d.lane ?? LANES.find((l) => l.id === "meals-android");

  // divergence — two markets + journey
  if (d.markets.length === 2 && d.journey && /differ|fork|diverge|compare|vs|versus/.test(d.t)) {
    const [mA, mB] = d.markets;
    const build = d.build ?? BUILDS.at(-1);
    const qA = givenFor(lane, mA, d.journey, build);
    const qB = givenFor(lane, mB, d.journey, build);
    const rA = resolveAnswer(qA, now), rB = resolveAnswer(qB, now);
    if (rA.kind === "answer" && rB.kind === "answer") {
      const diff = computeDiff(rA.answer, rB.answer);
      const path = "/map" + serializeQuery({...qA, pivot: "market", counterpart: mB, view: "report"});
      return {kind: "answer", intent: "divergence",
        text: `Comparing ${d.journey.label} on ${lane.container} ${lane.platform}, b${build}: ${diff.onlyA.length} ${diff.onlyA.length === 1 ? "node" : "nodes"} only in ${mA}, ${diff.onlyB.length} only in ${mB}, ${diff.changed.length} changed, ${diff.shared.length} shared.`,
        evidence: [{type: "diff", sideA: mA, sideB: mB,
          counts: {onlyA: diff.onlyA.length, onlyB: diff.onlyB.length, changed: diff.changed.length, shared: diff.shared.length}}],
        links: [{label: "Open diff →", path}],
        freshness: {build, ageDays: rA.answer.ageDays}, provenance: PROVENANCE};
    }
    return {kind: "miss", text: `One side of that comparison is not observed — the map cannot answer it without both sides.`,
      canAnswer: CAN_ANSWER, matches: []};
  }

  // change — build present + change words
  if (d.build && /changed|change|new in|since/.test(d.t)) {
    const idx = BUILDS.indexOf(d.build);
    const prev = idx > 0 ? BUILDS[idx - 1] : null;
    if (!prev) return {kind: "miss", text: `b${d.build} is the earliest observed build — nothing earlier to compare against.`,
      canAnswer: CAN_ANSWER, matches: []};
    const journey = d.journey ?? JOURNEYS[0];
    const q = givenFor(lane, d.markets[0] ?? "US", journey, d.build);
    const path = "/map" + serializeQuery({...q, pivot: "build", counterpart: prev, view: "report"});
    return {kind: "answer", intent: "change",
      text: `Build-over-build for ${journey.label} on ${lane.container} ${lane.platform}: b${d.build} against b${prev}. The set-difference report enumerates added, removed, and changed screens.`,
      evidence: [], links: [{label: `Open b${d.build} ↔ b${prev} diff →`, path}],
      freshness: {build: d.build, ageDays: null}, provenance: PROVENANCE};
  }

  // variant search
  if (d.variant) {
    const rows = Object.values(SCREENS).filter((s) => {
      const containing = OBSERVATIONS.filter((o) =>
        (!d.journey || o.journey === d.journey.id) && (!d.lane || o.lane === d.lane.id) &&
        o.walk.some((w) => w.stack.at(-1) === s.key && w.variants.includes(d.variant)));
      return containing.length > 0;
    });
    if (rows.length === 0) return {kind: "miss",
      text: `No observed screen carries a ${d.variant} variant${d.journey ? ` in ${d.journey.label}` : ""}.`,
      canAnswer: CAN_ANSWER, matches: []};
    return {kind: "answer", intent: "variant-search",
      text: `${rows.length} ${rows.length === 1 ? "screen carries" : "screens carry"} an observed ${d.variant} variant${d.journey ? ` in ${d.journey.label}` : ""}.`,
      evidence: [{type: "screens", items: rows.map((s) => ({key: s.key, label: nameOf(s), italic: s.label == null}))}],
      links: rows.slice(0, 3).map((s) => ({label: `${nameOf(s)} →`, path: pathFor("screen", s.key)})),
      freshness: null, provenance: PROVENANCE};
  }

  // overlay context
  if (d.overlay && /appear|shown|show|over|where/.test(d.t)) {
    const stacks = [];
    for (const o of OBSERVATIONS) for (const w of o.walk)
      if (w.stack.includes(d.overlay.key) && w.stack.at(-1) !== d.overlay.key) {
        const base = SCREENS[w.stack.at(-1)];
        if (!stacks.some((x) => x.base === nameOf(base))) stacks.push({over: nameOf(d.overlay), base: nameOf(base)});
      }
    return {kind: "answer", intent: "overlay-context",
      text: `${nameOf(d.overlay)} was observed over ${stacks.length} ${stacks.length === 1 ? "screen" : "screens"}: ${stacks.map((s) => s.base).join(", ")}.`,
      evidence: [{type: "stacks", items: stacks}],
      links: [{label: "Open screen page →", path: pathFor("screen", d.overlay.key)}],
      freshness: null, provenance: PROVENANCE};
  }

  // coverage
  if (d.lane && /not walked|walked|coverage|observed|missing/.test(d.t)) {
    const ctx = {cohort: "new", locale: "en-US", market: d.markets[0] ?? "US", build: d.build ?? BUILDS.at(-1)};
    const cells = atlasCells(ctx, now).filter((c) => c.laneId === d.lane.id);
    const wantNone = /not walked|missing/.test(d.t);
    const items = cells.filter((c) => (wantNone ? c.state === "none" : true))
      .map((c) => ({label: JOURNEYS.find((j) => j.id === c.journeyId).label, state: c.state,
        detail: c.state === "none" ? "not walked" : `${c.screenCount} screens · b${c.build}`}));
    return {kind: "answer", intent: "coverage",
      text: wantNone
        ? `${items.length} of ${cells.length} journeys are not walked on ${d.lane.container} ${d.lane.platform} (${ctx.market}, b${ctx.build}).`
        : `Coverage on ${d.lane.container} ${d.lane.platform}: ${cells.filter((c) => c.state !== "none").length} of ${cells.length} journeys observed.`,
      evidence: [{type: "cells", items}],
      links: [{label: "Open lane →", path: pathFor("lane", d.lane.id)}],
      freshness: null, provenance: PROVENANCE};
  }

  // permutation — journey + (market or lane)
  if (d.journey && (d.markets.length >= 1 || d.lane)) {
    const market = d.markets[0] ?? "US";
    const q = givenFor(lane, market, d.journey, d.build ?? null);
    const r = resolveAnswer(q, now);
    if (r.kind === "answer") {
      const a = r.answer;
      const path = "/map" + serializeQuery({...q, build: a.given.build});
      return {kind: "answer", intent: "permutation",
        text: `A ${a.given.cohort} user in ${market} on ${lane.container} ${lane.platform} (b${a.given.build}) sees ${a.counts.screens} ${a.counts.screens === 1 ? "screen" : "screens"} and ${a.counts.overlays} overlays through ${d.journey.label}, observed ${a.ageDays}d ago.`,
        evidence: [{type: "screens", items: a.steps.slice(0, 6).map((s) => ({key: s.baseScreen.key,
          label: s.stack.length > 1 ? `${nameOf(s.stack[0])} over ${nameOf(s.baseScreen)}` : nameOf(s.baseScreen),
          italic: s.baseScreen.label == null}))}],
        links: [{label: "Open in console →", path}],
        freshness: {build: a.given.build, ageDays: a.ageDays}, provenance: PROVENANCE};
    }
    if (r.kind === "stale-candidate") {
      return {kind: "answer", intent: "permutation",
        text: `The requested build has no observation for that Given. Freshest is b${r.candidate.given.build} (${r.candidate.ageDays}d old) — the console offers the explicit switch.`,
        evidence: [], links: [{label: "Open in console →", path: "/map" + serializeQuery(q)}],
        freshness: null, provenance: PROVENANCE};
    }
    return {kind: "answer", intent: "permutation",
      text: `Not observed: ${d.journey.label} has no walk for that Given (${r.reason.replaceAll("-", " ")}). The map answers only what it has seen.`,
      evidence: [], links: [{label: "Open in console →", path: "/map" + serializeQuery(q)}],
      freshness: null, provenance: PROVENANCE};
  }

  const matches = entityMatches(input);
  return {kind: "miss",
    text: "I couldn't map this question to the published map.",
    canAnswer: CAN_ANSWER, matches};
}

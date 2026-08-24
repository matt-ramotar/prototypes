// Deterministic layered layout for the thread map. No layout library: the graph is
// a DAG per journey, so longest-path ranking plus a median crossing-reduction pass
// is enough and — unlike a force simulation — gives the same picture every time.
//
// Ranking runs on the DECLARED edges, because those carry the branches. Observed
// transitions are drawn but do not move anything, with one exception: a screen that
// no declared edge touches has nowhere to sit, so its observed transitions are
// allowed to place it. Otherwise every overlay would collapse onto rank 0.

import {JOURNEYS, SCREENS} from "./fixtures.js";

export const GEOM = {
  nodeW: 88,
  nodeH: 168,
  colGap: 48,
  rowGap: 26,
  laneGap: 64,
  lanePadTop: 32,
  pad: 48,
};

const phaseIndex = (key) => {
  const s = SCREENS[key];
  const j = JOURNEYS.find((x) => x.id === s.journeyId);
  return j ? j.phases.indexOf(s.phase) : 0;
};

function rankingEdges(nodes, edges) {
  const declaredDegree = new Map(nodes.map((n) => [n.key, 0]));
  for (const e of edges) {
    if (!e.declared) continue;
    declaredDegree.set(e.from, (declaredDegree.get(e.from) ?? 0) + 1);
    declaredDegree.set(e.to, (declaredDegree.get(e.to) ?? 0) + 1);
  }
  const orphan = (k) => (declaredDegree.get(k) ?? 0) === 0;
  return edges.filter((e) => e.declared || orphan(e.from) || orphan(e.to));
}

/** Longest path from any source. Guarded so a cycle can never spin forever. */
function rankNodes(keys, edges) {
  const preds = new Map(keys.map((k) => [k, []]));
  for (const e of edges) if (preds.has(e.to) && preds.has(e.from)) preds.get(e.to).push(e.from);
  for (const [, list] of preds) list.sort();
  const rank = new Map();
  const resolve = (k, guard) => {
    if (rank.has(k)) return rank.get(k);
    if (guard.has(k)) return 0;
    guard.add(k);
    const p = preds.get(k);
    const r = p.length === 0 ? 0 : Math.max(...p.map((x) => resolve(x, guard) + 1));
    guard.delete(k);
    rank.set(k, r);
    return r;
  };
  for (const k of [...keys].sort()) resolve(k, new Set());
  return rank;
}

/** Median heuristic, fixed sweep count, tie-broken on the frozen key so it is stable. */
function orderLayers(keys, edges, rank, sweeps = 6) {
  const maxRank = keys.length === 0 ? 0 : Math.max(...keys.map((k) => rank.get(k)));
  const layers = [];
  for (let r = 0; r <= maxRank; r++) {
    layers[r] = keys.filter((k) => rank.get(k) === r)
      .sort((a, b) => phaseIndex(a) - phaseIndex(b) || a.localeCompare(b));
  }
  const preds = new Map(keys.map((k) => [k, []]));
  const succs = new Map(keys.map((k) => [k, []]));
  for (const e of edges) {
    if (!preds.has(e.to) || !succs.has(e.from)) continue;
    preds.get(e.to).push(e.from);
    succs.get(e.from).push(e.to);
  }
  const positions = () => {
    const p = new Map();
    for (const layer of layers) layer.forEach((k, i) => p.set(k, i));
    return p;
  };
  const median = (k, side, pos) => {
    const ns = (side === "up" ? preds : succs).get(k)
      .map((x) => pos.get(x)).filter((v) => v != null).sort((a, b) => a - b);
    if (ns.length === 0) return null;
    const m = Math.floor(ns.length / 2);
    return ns.length % 2 ? ns[m] : (ns[m - 1] + ns[m]) / 2;
  };
  for (let s = 0; s < sweeps; s++) {
    const down = s % 2 === 0;
    const pos = positions();
    const order = layers.map((_, i) => (down ? i : layers.length - 1 - i));
    for (const r of order) {
      layers[r] = layers[r]
        .map((k, i) => ({k, i, m: median(k, down ? "up" : "down", pos)}))
        .sort((a, b) => (a.m ?? a.i) - (b.m ?? b.i) || a.k.localeCompare(b.k))
        .map((x) => x.k);
    }
  }
  return layers;
}

/**
 * Pull each node toward the median of its predecessors so long runs read as straight
 * lines, then pack the column so nothing overlaps. Order inside a layer is fixed by
 * this point, so packing can only shift rows, never reorder them.
 */
function assignRows(layers, edges) {
  const preds = new Map();
  for (const e of edges) {
    if (!preds.has(e.to)) preds.set(e.to, []);
    preds.get(e.to).push(e.from);
  }
  const row = new Map();
  layers.forEach((layer, r) => {
    const desired = layer.map((k, i) => {
      if (r === 0) return i;
      const ps = (preds.get(k) ?? []).map((x) => row.get(x)).filter((v) => v != null);
      if (ps.length === 0) return i;
      ps.sort((a, b) => a - b);
      const m = Math.floor(ps.length / 2);
      return ps.length % 2 ? ps[m] : (ps[m - 1] + ps[m]) / 2;
    });
    let last = -Infinity;
    layer.forEach((k, i) => {
      const y = Math.max(desired[i], last + 1);
      row.set(k, y);
      last = y;
    });
  });
  return row;
}

/**
 * Lays every journey out as its own horizontal band. Returns world coordinates;
 * the view transform is the caller's business.
 */
export function layoutGraph(graph, geom = GEOM) {
  const lanes = [];
  const nodes = [];
  let cursorY = geom.pad;
  let maxX = 0;

  for (const journey of graph.journeys) {
    const keys = graph.nodes.filter((n) => n.journeyId === journey.id)
      .map((n) => n.key).sort();
    if (keys.length === 0) continue;
    const scope = new Set(keys);
    const within = graph.edges.filter((e) => scope.has(e.from) && scope.has(e.to));
    const forRank = rankingEdges(graph.nodes.filter((n) => scope.has(n.key)), within);
    const rank = rankNodes(keys, forRank);
    const layers = orderLayers(keys, forRank, rank);
    const row = assignRows(layers, forRank);

    const rows = keys.map((k) => row.get(k));
    const minRow = Math.min(...rows);
    const laneHeight = (Math.max(...rows) - minRow) * (geom.nodeH + geom.rowGap) + geom.nodeH;
    const top = cursorY + geom.lanePadTop;

    for (const k of keys) {
      const x = geom.pad + rank.get(k) * (geom.nodeW + geom.colGap);
      const y = top + (row.get(k) - minRow) * (geom.nodeH + geom.rowGap);
      nodes.push({key: k, x, y, w: geom.nodeW, h: geom.nodeH, rank: rank.get(k), journeyId: journey.id});
      maxX = Math.max(maxX, x + geom.nodeW);
    }

    lanes.push({
      journeyId: journey.id,
      label: journey.label,
      team: journey.team,
      y: cursorY,
      height: geom.lanePadTop + laneHeight,
      nodeCount: keys.length,
    });
    cursorY += geom.lanePadTop + laneHeight + geom.laneGap;
  }

  const at = new Map(nodes.map((n) => [n.key, n]));
  const width = maxX + geom.pad;
  for (const lane of lanes) lane.width = width;

  const edges = graph.edges.map((e) => {
    const a = at.get(e.from), b = at.get(e.to);
    if (!a || !b) return null;
    return {...e, ...anchorEdge(a, b)};
  }).filter(Boolean);

  return {
    nodes,
    edges,
    lanes,
    bounds: {
      x: 0,
      y: 0,
      width,
      height: Math.max(cursorY - geom.laneGap + geom.pad, geom.pad * 2),
    },
  };
}

/**
 * Anchors an edge on the facing sides of the two boxes and returns a cubic whose
 * handles are horizontal, so a same-row edge is a straight line and a rank-skipping
 * one bows clear of whatever sits between.
 */
export function anchorEdge(a, b) {
  const forward = b.x >= a.x;
  const x1 = forward ? a.x + a.w : a.x;
  const x2 = forward ? b.x : b.x + b.w;
  const y1 = a.y + a.h / 2;
  const y2 = b.y + b.h / 2;
  const span = Math.abs(x2 - x1);
  const bow = Math.max(24, Math.min(span * 0.5, 90));
  const c1 = forward ? x1 + bow : x1 - bow;
  const c2 = forward ? x2 - bow : x2 + bow;
  return {
    x1, y1, x2, y2,
    path: `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`,
    midX: (x1 + x2) / 2,
    midY: (y1 + y2) / 2,
  };
}

/**
 * Scale and translation that fit `bounds` into a viewport.
 *
 * A wide graph squeezed to fit stops being readable long before it stops fitting,
 * so scale is floored: below `minScale` the map is anchored to its top-left corner
 * and the reader pans instead. An axis that still fits stays centred.
 */
export function fitTransform(bounds, viewport,
  {padding = 32, maxScale = 1.1, minScale = 0.72} = {}) {
  const w = Math.max(bounds.width, 1), h = Math.max(bounds.height, 1);
  const raw = Math.min(
    (viewport.width - padding * 2) / w,
    (viewport.height - padding * 2) / h,
    maxScale,
  );
  const scale = Math.max(raw, minScale);
  const place = (extent, available) => {
    const size = extent * scale;
    return size <= available - padding * 2 ? (available - size) / 2 : padding;
  };
  return {
    scale,
    x: place(w, viewport.width) - bounds.x * scale,
    y: place(h, viewport.height) - bounds.y * scale,
  };
}

/** Zoom about a point in screen space, so the world point under the cursor stays put. */
export function zoomAt(view, point, factor, {min = 0.15, max = 2.5} = {}) {
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  const k = scale / view.scale;
  return {
    scale,
    x: point.x - (point.x - view.x) * k,
    y: point.y - (point.y - view.y) * k,
  };
}

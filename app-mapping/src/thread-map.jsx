import {useMemo, useState} from "react";
import {Alert, ScrollShadow} from "@heroui/react";
import {JOURNEYS, SCREENS} from "./fixtures.js";
import {threadGraph, threads} from "./thread-graph.js";
import {layoutGraph} from "./thread-layout.js";
import {ThreadCanvas} from "./thread-canvas.jsx";
import {QueryPills} from "./pills.jsx";
import {Token} from "./given.jsx";
import {EmptyPanel, GIcon, NamedScreen, StatusDot} from "./ui.jsx";

const ALL = JOURNEYS.map((j) => j.id);
const nameOf = (key) => SCREENS[key].label ?? SCREENS[key].derivedLabel;

const THREAD_STATE = {
  walked: {dot: "fresh", label: "walked under this Given"},
  partial: {dot: "stale", label: "partly walked"},
  unwalked: {dot: "none", label: "never walked here"},
};

export function ThreadRow({thread, active, onHover, onSelect}) {
  const meta = THREAD_STATE[thread.state];
  return (
    <button type="button"
      className={`flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left ${
        active ? "bg-surface-secondary shadow-[inset_2px_0_0_var(--accent)]" : "hover:bg-surface-secondary"
      }`}
      onMouseEnter={() => onHover(thread)} onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(thread)} onBlur={() => onHover(null)}
      onClick={() => onSelect(thread)}>
      <span className="flex items-center gap-2">
        <StatusDot state={meta.dot} />
        <span className="font-mono text-sm font-semibold tabular-nums">{thread.keys.length}</span>
        <span className="text-xs text-muted">screens</span>
        <span className="ml-auto font-mono text-[11px] text-muted">{thread.walkedLegs}/{thread.legs.length}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1 text-xs font-medium">
        {nameOf(thread.keys[0])}
        <GIcon name="arrow-right" size={11} className="text-muted" />
        {nameOf(thread.keys.at(-1))}
      </span>
      <span className="text-[11px] text-muted">{meta.label}</span>
    </button>
  );
}

function Legend({compact = false}) {
  if (compact) {
    return (
      <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-200px)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-overlay backdrop-blur-md">
        <span className="flex items-center gap-1.5"><StatusDot state="fresh" />This build</span>
        <span className="flex items-center gap-1.5"><StatusDot state="stale" />Older</span>
        <span className="flex items-center gap-1.5"><span className="am-swatch" data-s="elsewhere" />Elsewhere</span>
        <span className="flex items-center gap-1.5"><span className="am-swatch" data-s="never" />Never</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-separator px-5 py-2 text-sm text-muted">
      <span className="text-xs font-medium">Observation</span>
      <span className="flex items-center gap-1.5"><StatusDot state="fresh" />Observed at this build</span>
      <span className="flex items-center gap-1.5"><StatusDot state="stale" />Observed, older build</span>
      <span className="flex items-center gap-1.5"><span className="am-swatch" data-s="elsewhere" />Exists, not observed here</span>
      <span className="flex items-center gap-1.5"><span className="am-swatch" data-s="never" />Declared, never walked</span>
      <span className="h-3.5 w-px bg-border" />
      <span className="text-xs font-medium">Transition</span>
      <span className="flex items-center gap-1.5"><span className="am-line" data-k="declared" />Declared</span>
      <span className="flex items-center gap-1.5"><span className="am-line" data-k="undeclared" />Observed, undeclared</span>
      <span className="flex items-center gap-1.5"><span className="am-line" data-k="blocked" />Non-traversable</span>
    </div>
  );
}

export function ThreadMapSurface({query, notes, onNavigate, onPivot, navigate, embedded = false,
  focusThread = null}) {
  const now = useMemo(() => new Date(), []);
  const given = {
    cohort: query.cohort ?? "new",
    locale: query.locale ?? "en-US",
    market: query.market ?? "US",
    build: query.build ?? "8.112",
    container: query.container ?? "meals",
    platform: query.platform ?? "android",
  };
  const scope = query.journey ? [query.journey] : ALL;

  const graph = useMemo(() => threadGraph(scope, given, now),
    [scope.join(","), given.cohort, given.locale, given.market, given.build,
      given.container, given.platform, now]);
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const rail = useMemo(() => threads(graph), [graph]);

  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredThread, setHoveredThread] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);

  const byKey = useMemo(() => new Map(graph.nodes.map((n) => [n.key, n])), [graph]);
  const stateOf = (key) => byKey.get(key) ?? {state: "never", screen: SCREENS[key]};

  const focus = focusThread ?? hoveredThread ?? selectedThread;
  const highlight = useMemo(() => {
    if (focus) {
      const nodes = new Set(focus.keys);
      const edges = new Set(focus.keys.slice(0, -1)
        .map((k, i) => `${k}>${focus.keys[i + 1]}`));
      return {nodes, edges};
    }
    if (hoveredNode) {
      const nodes = new Set([hoveredNode]);
      const edges = new Set();
      for (const e of graph.edges) {
        if (e.from !== hoveredNode && e.to !== hoveredNode) continue;
        edges.add(e.id);
        nodes.add(e.from);
        nodes.add(e.to);
      }
      return {nodes, edges};
    }
    return null;
  }, [focus, hoveredNode, graph, focusThread]);

  const openScreen = (key) => navigate({path: `/screens/${encodeURIComponent(key)}`, patch: {}});
  const openWalk = (thread) => {
    if (thread.state === "unwalked") {
      setSelectedThread((prev) => (prev?.id === thread.id ? null : thread));
      return;
    }
    navigate({
      path: "/map",
      patch: {
        journey: thread.journeyId,
        container: given.container,
        platform: given.platform,
        cohort: given.cohort,
        locale: given.locale,
        market: given.market,
        build: given.build,
      },
    });
  };
  const setScope = (id) => onNavigate({journey: id === "__all__" ? null : id});

  const grouped = JOURNEYS.filter((j) => scope.includes(j.id)).map((j) => ({
    journey: j,
    declared: rail.declared.filter((t) => t.journeyId === j.id),
    undeclared: rail.undeclared.filter((e) => e.journeyId === j.id),
  })).filter((g) => g.declared.length > 0 || g.undeclared.length > 0);

  const canvas = layout.nodes.length === 0 ? (
    <div className="grid flex-1 place-items-center">
      <EmptyPanel icon="map-pin" title="Nothing to draw"
        description="No screen in this scope belongs to the published map." />
    </div>
  ) : (
    <ThreadCanvas layout={layout} stateOf={stateOf} highlight={highlight}
      selected={null} hovered={hoveredNode}
      onHover={setHoveredNode} onSelect={openScreen} fitToken={scope.join()} />
  );

  if (embedded) {
    return (
      <div className="relative h-full min-h-0">
        <div className="h-full min-h-0">{canvas}</div>
        <Legend compact />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-separator px-5 py-3">
        <QueryPills query={{...query, ...given}} onNavigate={onNavigate} onPivot={onPivot} />
        <span className="inline-flex items-center gap-2">
          <span className="text-xs text-muted">Showing</span>
          <Token value={query.journey ?? "__all__"} tone="accent"
            display={query.journey ? JOURNEYS.find((j) => j.id === query.journey)?.label : "All journeys"}
            options={[{id: "__all__", label: "All journeys", sub: `${ALL.length} journeys`},
              ...JOURNEYS.map((j) => ({id: j.id, label: j.label, sub: `${j.phases.length} phases`}))]}
            onSelect={setScope} />
        </span>
        <span className="ml-auto font-mono text-xs text-muted">
          {graph.counts.nodes} screens · {graph.counts.declaredEdges} declared
          {graph.counts.undeclaredEdges > 0 ? ` · ${graph.counts.undeclaredEdges} undeclared` : ""}
        </span>
      </div>

      {notes?.length ? (
        <Alert status="warning" className="mx-5 mt-3">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{notes.join(" · ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <ScrollShadow className="hidden w-[268px] shrink-0 overflow-y-auto border-r border-separator px-3 py-3.5 md:block">
          <div className="mb-2.5 px-2">
            <p className="text-xs font-medium text-muted">Threads</p>
            <p className="text-xs text-muted">
              {rail.declared.length} declared · {rail.undeclared.length} observed only
            </p>
          </div>
          {grouped.length === 0 ? (
            <p className="px-2 text-sm text-muted">No transitions are declared or observed in this scope.</p>
          ) : grouped.map(({journey, declared, undeclared}) => (
            <section key={journey.id} className="mt-3">
              <h3 className="mb-1.5 px-2 text-xs font-semibold text-muted">{journey.label}</h3>
              {declared.map((t) => (
                <ThreadRow key={t.id} thread={t}
                  active={selectedThread?.id === t.id}
                  onHover={setHoveredThread}
                  onSelect={openWalk} />
              ))}
              {undeclared.map((e) => (
                <button key={e.id} type="button"
                  className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-surface-secondary"
                  onMouseEnter={() => setHoveredThread({id: e.id, keys: [e.from, e.to]})}
                  onMouseLeave={() => setHoveredThread(null)}
                  onClick={() => openScreen(e.from)}>
                  <span className="flex items-center gap-2">
                    <StatusDot state={e.state === "fresh" ? "fresh" : e.state === "stale" ? "stale" : "none"} />
                    <span className="text-xs text-muted">observed, not declared</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-xs font-medium">
                    <NamedScreen screen={SCREENS[e.from]} />
                    <GIcon name="arrow-right" size={11} className="text-muted" />
                    <NamedScreen screen={SCREENS[e.to]} />
                  </span>
                  <span className="text-[11px] text-muted">
                    {e.runs.length > 0 ? `seen in ${e.runs.join(", ")}` : "seen under another Given"}
                  </span>
                </button>
              ))}
            </section>
          ))}
        </ScrollShadow>
        {canvas}
      </div>

      <Legend />
    </div>
  );
}

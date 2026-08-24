import {useMemo, useState} from "react";
import {Alert, Button, Card, Kbd} from "@heroui/react";
import {Segment} from "@heroui-pro/react/segment";
import {BUILDS, FACETS, JOURNEYS, LANES, SCREENS} from "./fixtures.js";
import {coverage, signals} from "./landing-view.js";
import {AtlasGrid, AtlasLegend} from "./atlas.jsx";
import {ThreadMapSurface, ThreadRow} from "./thread-map.jsx";
import {threadGraph, threads} from "./thread-graph.js";
import {Sentence, SentenceLead, Token} from "./given.jsx";
import {GIcon, StatusDot} from "./ui.jsx";

const LAYERS = [
  {id: "territory", label: "Territory"},
  {id: "coverage", label: "Coverage"},
];

const SUGGEST = {
  freshest: {label: "Freshest", icon: "circle-check"},
  stalest: {label: "Decayed", icon: "clock-arrow-rotate-left"},
  thinnest: {label: "Thinnest", icon: "circle-dashed"},
};

function contextFrom(query) {
  const lane = LANES.find((l) =>
    l.container.toLowerCase() === (query.container ?? "meals") &&
    l.platform.toLowerCase() === (query.platform ?? "android")) ?? LANES[0];
  return {
    cohort: query.cohort ?? "new",
    locale: query.locale ?? "en-US",
    market: query.market ?? "US",
    build: query.build ?? BUILDS.at(-1),
    journeyId: query.journey ?? JOURNEYS[0].id,
    lane,
  };
}

function SuggestChip({kind, cell, onOpen}) {
  const copy = SUGGEST[kind];
  if (!cell) return null;
  return (
    <Button size="sm" variant="secondary" onPress={() => onOpen(cell)}>
      <GIcon name={copy.icon} size={13} />
      {copy.label}
      <span className="font-semibold">{cell.journey.label}</span>
      <StatusDot state={cell.state} />
    </Button>
  );
}

function nameOf(key) {
  return SCREENS[key].label ?? SCREENS[key].derivedLabel;
}

export function MapHome({query, notes, navigate, onNavigate, onAsk, onPivot}) {
  const [layer, setLayer] = useState("territory");
  const [focusThread, setFocusThread] = useState(null);
  const now = useMemo(() => new Date(), []);
  const ctx = contextFrom(query);
  const cov = coverage(ctx, now);
  const sig = signals(ctx, now);

  const given = {
    cohort: ctx.cohort,
    locale: ctx.locale,
    market: ctx.market,
    build: ctx.build,
    container: ctx.lane.container.toLowerCase(),
    platform: ctx.lane.platform.toLowerCase(),
  };
  const graph = useMemo(
    () => threadGraph([ctx.journeyId], given, now),
    [ctx.journeyId, given.cohort, given.locale, given.market, given.build,
      given.container, given.platform, now]);
  const rail = useMemo(() => threads(graph), [graph]);
  const routes = rail.declared.filter((t) => t.state !== "unwalked");

  const set = (patch) => onNavigate({
    ...ctx,
    journey: ctx.journeyId,
    container: ctx.lane.container.toLowerCase(),
    platform: ctx.lane.platform.toLowerCase(),
    ...patch,
  });
  const answer = (patch = {}) => onNavigate({
    ...ctx,
    journey: ctx.journeyId,
    container: ctx.lane.container.toLowerCase(),
    platform: ctx.lane.platform.toLowerCase(),
    ...patch,
    go: true,
  });
  const openCell = (cell) => onNavigate({
    ...ctx,
    journey: cell.journeyId,
    container: cell.lane.container.toLowerCase(),
    platform: cell.lane.platform.toLowerCase(),
    build: cell.build,
    go: true,
  });
  const openWalk = (thread) => {
    if (thread.state === "unwalked") return;
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

  return (
    <div className="relative h-full min-h-0">
      <div className="absolute inset-0 flex min-h-0 flex-col">
        {layer === "territory" ? (
          <ThreadMapSurface embedded
            query={{...query, journey: ctx.journeyId, ...given}}
            notes={null} navigate={navigate}
            focusThread={focusThread}
            onNavigate={(patch) => onNavigate(patch)} onPivot={onPivot} />
        ) : (
          <div className="h-full overflow-auto px-4 pt-4 pb-16 md:pr-8 md:pl-[400px]">
            <AtlasGrid cells={cov.cells} onOpen={(j, l) => onNavigate({
              ...ctx, journey: j.id,
              container: l.container.toLowerCase(), platform: l.platform.toLowerCase(),
              go: true,
            })} />
            <AtlasLegend />
          </div>
        )}
      </div>

      <Card className="absolute top-3 left-3 z-20 flex max-h-[calc(100%-24px)] w-[min(380px,calc(100%-24px))] flex-col gap-0 overflow-y-auto p-0">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="min-w-0 flex-1 justify-start" onPress={onAsk}
              aria-label="Ask the Map">
              <GIcon name="magnifier" size={16} />
              <span className="flex-1 truncate text-left text-muted">Ask the Map</span>
              <Kbd>
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>K</Kbd.Content>
              </Kbd>
            </Button>
            <Segment size="sm" variant="ghost" selectedKey={layer}
              onSelectionChange={(k) => setLayer(String(k))} aria-label="Map layer">
              {LAYERS.map((l) => (
                <Segment.Item key={l.id} id={l.id}>{l.label}</Segment.Item>
              ))}
            </Segment>
          </div>

          <div className="flex flex-col gap-2">
            <Sentence>
              <SentenceLead>Given</SentenceLead>
              <Token value={ctx.cohort} options={FACETS.cohort} onSelect={(v) => set({cohort: v})} />
              <SentenceLead>in</SentenceLead>
              <Token value={ctx.market} options={FACETS.market} onSelect={(v) => set({market: v})} />
              <SentenceLead>speaking</SentenceLead>
              <Token value={ctx.locale} options={FACETS.locale} onSelect={(v) => set({locale: v})} mono />
              <SentenceLead>on</SentenceLead>
              <Token value={`b${ctx.build}`} mono
                options={BUILDS.map((b) => ({id: b, label: `b${b}`}))}
                onSelect={(v) => set({build: v})} />
            </Sentence>
            <Sentence>
              <SentenceLead>When</SentenceLead>
              <Token value={ctx.journeyId} tone="accent"
                display={JOURNEYS.find((j) => j.id === ctx.journeyId)?.label}
                options={JOURNEYS.map((j) => ({id: j.id, label: j.label, sub: `${j.phases.length} phases`}))}
                onSelect={(v) => set({journey: v})} />
              <SentenceLead>in</SentenceLead>
              <Token value={ctx.lane.id} tone="accent"
                display={`${ctx.lane.container} · ${ctx.lane.platform}`}
                options={LANES.map((l) => ({id: l.id, label: `${l.container} · ${l.platform}`, sub: l.surface}))}
                onSelect={(v) => {
                  const l = LANES.find((x) => x.id === v);
                  set({container: l.container.toLowerCase(), platform: l.platform.toLowerCase()});
                }} />
              <Button variant="primary" size="sm" onPress={() => answer()}>
                Then
                <GIcon name="arrow-right" size={14} />
              </Button>
            </Sentence>
            <p className="text-sm text-muted">
              <span className="font-mono tabular-nums">{cov.observed}</span> of{" "}
              <span className="font-mono tabular-nums">{cov.total}</span> pairs
              {" · "}
              <span className="font-mono tabular-nums">{cov.screens}</span> screens
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {["freshest", "stalest", "thinnest"].map((k) => (
              <SuggestChip key={k} kind={k} cell={sig[k]} onOpen={openCell} />
            ))}
          </div>

          {layer === "territory" && routes.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Routes</p>
              {routes.map((t) => (
                <ThreadRow key={t.id} thread={t}
                  active={focusThread?.id === t.id}
                  onHover={setFocusThread}
                  onSelect={openWalk} />
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      {notes?.length ? (
        <Alert status="warning" className="absolute top-3 left-1/2 z-20 max-w-md -translate-x-1/2">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{notes.join(" · ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {layer === "territory" && rail.undeclared.length > 0 ? (
        <p className="absolute top-14 right-4 z-10 max-w-[280px] text-right text-xs text-muted">
          {rail.undeclared.length} observed, not declared
          {rail.undeclared.slice(0, 2).map((e) => (
            <span key={e.id}> · {nameOf(e.from)} → {nameOf(e.to)}</span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

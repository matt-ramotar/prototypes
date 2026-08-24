import {Button, Card} from "@heroui/react";
import {BUILDS, FACETS, JOURNEYS, LANES} from "./fixtures.js";
import {coverage, signals} from "./landing-view.js";
import {AtlasGrid, AtlasLegend} from "./atlas.jsx";
import {Sentence, SentenceLead, Token} from "./given.jsx";
import {GIcon, PAGE_WIDE, StatusDot} from "./ui.jsx";

const SIGNAL_COPY = {
  freshest: {label: "Freshest evidence", icon: "circle-check",
    hint: "Most recently observed cell in this Given."},
  stalest: {label: "Decayed furthest", icon: "clock-arrow-rotate-left",
    hint: "Observed, but on the oldest build still standing in."},
  thinnest: {label: "Thinnest evidence", icon: "circle-dashed",
    hint: "Fewest observations behind the answer — treat as provisional."},
};

function SignalCard({kind, cell, onOpen}) {
  const copy = SIGNAL_COPY[kind];
  if (!cell) {
    return (
      <Card className="gap-2 p-5">
        <Card.Header className="p-0">
          <Card.Title className="text-sm font-normal text-muted">{copy.label}</Card.Title>
        </Card.Header>
        <Card.Content className="p-0 text-sm text-muted">Nothing observed in this Given.</Card.Content>
      </Card>
    );
  }
  return (
    <button type="button" className="text-left" onClick={() => onOpen(cell)}>
      <Card className="h-full gap-2 p-5">
        <Card.Header className="flex-row items-center gap-2 p-0">
          <GIcon name={copy.icon} size={13} />
          <Card.Title className="text-sm font-normal text-muted">{copy.label}</Card.Title>
          <GIcon name="arrow-right" size={13} className="ml-auto text-muted" />
        </Card.Header>
        <Card.Content className="gap-1 p-0">
          <p className="font-semibold">{cell.journey.label}</p>
          <p className="text-sm text-muted">{cell.lane.container} · {cell.lane.platform}</p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-sm">
            <StatusDot state={cell.state} />
            {kind === "thinnest"
              ? `${cell.obsCount} obs`
              : `${cell.ageDays}d · b${cell.build}`}
          </p>
          <p className="mt-1 text-xs text-muted">{copy.hint}</p>
        </Card.Content>
      </Card>
    </button>
  );
}

export function ControlRoomLanding({query, onNavigate}) {
  const now = new Date();
  const context = {
    cohort: query.cohort ?? "new",
    locale: query.locale ?? "en-US",
    market: query.market ?? "US",
    build: query.build ?? BUILDS.at(-1),
  };
  const journeyId = query.journey ?? JOURNEYS[0].id;
  const lane = LANES.find((l) =>
    l.container.toLowerCase() === (query.container ?? "meals") &&
    l.platform.toLowerCase() === (query.platform ?? "android")) ?? LANES[0];

  const cov = coverage(context, now);
  const sig = signals(context, now);
  const set = (patch) => onNavigate({...context, journey: journeyId,
    container: lane.container.toLowerCase(), platform: lane.platform.toLowerCase(), ...patch});
  const answer = (patch = {}) => onNavigate({...context, journey: journeyId,
    container: lane.container.toLowerCase(), platform: lane.platform.toLowerCase(),
    ...patch, go: true});

  const openCell = (cell) => onNavigate({...context, journey: cell.journeyId,
    container: cell.lane.container.toLowerCase(), platform: cell.lane.platform.toLowerCase(),
    build: cell.build, go: true});

  return (
    <div className={PAGE_WIDE}>
      <p className="text-xs font-medium text-muted">The question</p>
      <div className="mt-2 flex flex-col gap-2">
        <Sentence>
          <SentenceLead>Given</SentenceLead>
          <Token value={context.cohort} options={FACETS.cohort} onSelect={(v) => set({cohort: v})} />
          <SentenceLead>in</SentenceLead>
          <Token value={context.market} options={FACETS.market} onSelect={(v) => set({market: v})} />
          <SentenceLead>speaking</SentenceLead>
          <Token value={context.locale} options={FACETS.locale} onSelect={(v) => set({locale: v})} mono />
          <SentenceLead>on</SentenceLead>
          <Token value={`b${context.build}`} mono
            options={BUILDS.map((b) => ({id: b, label: `b${b}`}))}
            onSelect={(v) => set({build: v})} />
        </Sentence>
        <Sentence>
          <SentenceLead>When</SentenceLead>
          <Token value={journeyId} tone="accent"
            display={JOURNEYS.find((j) => j.id === journeyId)?.label}
            options={JOURNEYS.map((j) => ({id: j.id, label: j.label, sub: `${j.phases.length} phases`}))}
            onSelect={(v) => set({journey: v})} />
          <SentenceLead>in</SentenceLead>
          <Token value={lane.id} tone="accent"
            display={`${lane.container} · ${lane.platform}`}
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
      </div>
      <p className="mt-2 text-sm text-muted">
        <span className="font-mono tabular-nums">{cov.observed}</span> of{" "}
        <span className="font-mono tabular-nums">{cov.total}</span> journey × lane pairs observed for this Given ·{" "}
        <span className="font-mono tabular-nums">{cov.screens}</span> screens on the spine ·{" "}
        <span className="font-mono tabular-nums">{cov.byState.none}</span> not walked
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {["freshest", "stalest", "thinnest"].map((k) => (
          <SignalCard key={k} kind={k} cell={sig[k]} onOpen={openCell} />
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Coverage</h2>
      <p className="mt-1 text-sm text-muted">
        {context.cohort} · {context.locale} · {context.market} · b{context.build}
      </p>
      <div className="mt-4">
        <AtlasGrid cells={cov.cells} onOpen={(j, l) => onNavigate({...context, journey: j.id,
          container: l.container.toLowerCase(), platform: l.platform.toLowerCase(), go: true})} />
        <AtlasLegend />
      </div>
    </div>
  );
}

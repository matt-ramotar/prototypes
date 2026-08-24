import {Button} from "@heroui/react";
import {BUILDS, FACETS, JOURNEYS, LANES} from "./fixtures.js";
import {Sentence, SentenceLead, Token} from "./given.jsx";
import {GIcon} from "./ui.jsx";

const PIVOTABLE = new Set(["cohort", "locale", "market", "build"]);

export function QueryPills({query, onNavigate, onPivot}) {
  const lane = LANES.find((l) =>
    l.container.toLowerCase() === query.container && l.platform.toLowerCase() === query.platform);
  const facets = [
    {field: "cohort", value: query.cohort, options: FACETS.cohort.map((o) => ({id: o, label: o}))},
    {field: "market", value: query.market, options: FACETS.market.map((o) => ({id: o, label: o}))},
    {field: "locale", value: query.locale, options: FACETS.locale.map((o) => ({id: o, label: o}))},
    {field: "build", value: query.build, display: query.build ? `b${query.build}` : null,
      options: BUILDS.map((b) => ({id: b, label: `b${b}`}))},
  ];

  return (
    <Sentence>
      <SentenceLead>Given</SentenceLead>
      {facets.map((f) =>
        query.pivot === f.field ? (
          <Button key={f.field} size="sm" variant="secondary"
            onPress={() => onNavigate({pivot: null, counterpart: null, view: null})}>
            {f.field === "build" ? `b${query.build} ↔ b${query.counterpart}` : `${query[f.field]} ↔ ${query.counterpart}`}
            <GIcon name="circle-xmark" size={12} />
          </Button>
        ) : (
          <Token key={f.field} mono value={f.value} display={f.display} options={f.options}
            onSelect={(v) => onNavigate({[f.field]: v, pivot: null, counterpart: null})}
            onCompare={PIVOTABLE.has(f.field) ? (v) => onPivot(f.field, v) : undefined} />
        ),
      )}
      {query.journey ? (
        <>
          <SentenceLead>When</SentenceLead>
          <Token value={query.journey} tone="accent"
            display={JOURNEYS.find((j) => j.id === query.journey)?.label}
            options={JOURNEYS.map((j) => ({id: j.id, label: j.label, sub: `${j.phases.length} phases`}))}
            onSelect={(v) => onNavigate({journey: v, pivot: null, counterpart: null})} />
        </>
      ) : null}
      {lane ? (
        <>
          <SentenceLead>in</SentenceLead>
          <Token value={lane.id} tone="accent" display={`${lane.container} · ${lane.platform}`}
            options={LANES.map((l) => ({id: l.id, label: `${l.container} · ${l.platform}`, sub: l.surface}))}
            onSelect={(v) => {
              const l = LANES.find((x) => x.id === v);
              onNavigate({container: l.container.toLowerCase(), platform: l.platform.toLowerCase()});
            }} />
        </>
      ) : null}
    </Sentence>
  );
}

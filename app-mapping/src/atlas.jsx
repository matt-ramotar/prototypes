import {Alert} from "@heroui/react";
import {JOURNEYS, LANES} from "./fixtures.js";
import {atlasCells, CELL_STATE_LABELS} from "./atlas-view.js";
import {QueryPills} from "./pills.jsx";
import {PAGE_WIDE, StatusDot} from "./ui.jsx";

function Cell({cell, onOpen}) {
  const state = cell.state;
  const detail = state === "none"
    ? "Not walked"
    : state === "thin"
      ? `${CELL_STATE_LABELS[state]} · ${cell.obsCount} ${cell.obsCount === 1 ? "observation" : "observations"}`
      : `${CELL_STATE_LABELS[state]} · ${cell.ageDays}d · b${cell.build}`;

  return (
    <button type="button" onClick={onOpen} className={`am-atlas-cell am-atlas-cell--${state}`}
      aria-label={detail}>
      {state === "none" ? (
        <span className="text-xs">Not walked</span>
      ) : (
        <>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <StatusDot state={state} />
            {cell.screenCount} {cell.screenCount === 1 ? "screen" : "screens"}
          </span>
          <span className="mt-1 block font-mono text-[10.5px] text-muted">{detail}</span>
        </>
      )}
    </button>
  );
}

export function AtlasGrid({cells, onOpen}) {
  const at = (j, l) => cells.find((c) => c.journeyId === j && c.laneId === l);
  return (
    <div className="am-atlas-wrap">
      <div className="am-atlas" style={{"--am-lanes": LANES.length}} role="table"
        aria-label="Journey coverage">
        <div className="am-atlas-head">Journey</div>
        {LANES.map((l) => (
          <div key={l.id} className="am-atlas-head">{l.container} · {l.platform}</div>
        ))}
        {JOURNEYS.map((j) => {
          const row = LANES.map((l) => at(j.id, l.id));
          return (
            <div key={j.id} style={{display: "contents"}}>
              <div className="am-atlas-journey">
                <div className="text-sm font-semibold tracking-tight">{j.label}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {j.phases.length} phases · {j.team}
                </div>
                <div className="am-cov" aria-hidden>
                  {row.map((c, i) => <span key={i} data-s={c.state === "none" ? undefined : c.state} />)}
                </div>
              </div>
              {LANES.map((l) => (
                <Cell key={l.id} cell={at(j.id, l.id)} onOpen={() => onOpen(j, l)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AtlasLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
      <span className="text-xs font-medium">Observation</span>
      <span className="flex items-center gap-1.5"><StatusDot state="fresh" />Fresh — selected build</span>
      <span className="flex items-center gap-1.5"><StatusDot state="stale" />Stale — older build</span>
      <span className="flex items-center gap-1.5"><StatusDot state="thin" />Thin — few observations</span>
      <span className="flex items-center gap-1.5"><StatusDot state="none" />Not walked</span>
    </div>
  );
}

export function AtlasSurface({query, notes, onNavigate, onPivot}) {
  const context = {cohort: query.cohort ?? "new", locale: query.locale ?? "en-US",
    market: query.market ?? "US", build: query.build ?? "8.112"};
  const cells = atlasCells(context, new Date());

  return (
    <div className={PAGE_WIDE}>
      {notes?.length ? (
        <Alert status="warning" className="mb-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{notes.join(" · ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <div className="mb-4">
        <QueryPills query={{...query, ...context, journey: null}} onNavigate={onNavigate} onPivot={onPivot} />
      </div>
      <AtlasGrid cells={cells} onOpen={(j, l) => onNavigate({journey: j.id,
        container: l.container.toLowerCase(), platform: l.platform.toLowerCase(), ...context})} />
      <AtlasLegend />
    </div>
  );
}

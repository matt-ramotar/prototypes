import {useMemo} from "react";
import {journeyEntity} from "./entity-view.js";
import {CELL_STATE_LABELS} from "./atlas-view.js";
import {LANES} from "./fixtures.js";
import {Link} from "./link.jsx";
import {EmptyPanel, NamedScreen, PAGE, PageHeader, StatCards, StatusDot} from "./ui.jsx";

export function JourneyPage({id, navigate}) {
  const e = useMemo(() => journeyEntity(id, new Date()), [id]);
  if (!e) {
    return (
      <div className={PAGE}>
        <EmptyPanel
          icon="route"
          title="Unknown journey"
          description={`No journey "${id}" exists in the published map.`}
          action={<Link to="journeys">Browse Journeys</Link>}
        />
      </div>
    );
  }
  const ctx = e.defaultContext;
  return (
    <div className={PAGE}>
      <PageHeader
        chip={e.journey.team}
        chipColor="accent"
        id={e.journey.coverageRowId}
        title={e.journey.label}
        description={e.journey.description}
      />

      <StatCards items={[
        {label: "Phases", value: e.kpis.phaseCount, note: e.journey.phases.join(" → "), tone: "text-muted"},
        {label: "Screens", value: e.kpis.screenCount, note: "in this journey", tone: "text-muted"},
        {label: "Lanes", value: e.kpis.laneCount, note: `of ${LANES.length} published`, tone: "text-muted"},
        {label: "Freshness", value: e.kpis.latestBuild ? `b${e.kpis.latestBuild}` : "—",
          note: e.kpis.ageDays != null ? `${e.kpis.ageDays}d ago` : "not observed",
          tone: e.kpis.latestBuild ? "text-success" : "text-muted"},
      ]} />

      <div className="mt-10 mb-3 text-sm text-muted">
        Coverage · {ctx.cohort} · {ctx.locale} · {ctx.market} · b{ctx.build} —{" "}
        <Link to="atlas">open Atlas</Link>
      </div>
      <div className="am-atlas-wrap mb-8">
        <div style={{display: "grid", gridTemplateColumns: `repeat(${e.atlasRow.length}, minmax(140px, 1fr))`}}>
          {e.atlasRow.map((cell) => {
            const lane = LANES.find((l) => l.id === cell.laneId);
            const open = () => navigate({path: "/map", patch: {journey: id,
              container: lane.container.toLowerCase(), platform: lane.platform.toLowerCase(), ...ctx}});
            return (
              <button key={cell.laneId} type="button" onClick={open}
                className={`am-atlas-cell am-atlas-cell--${cell.state}`}>
                <span className="text-xs font-semibold">{lane.container} · {lane.platform}</span>
                {cell.state === "none" ? (
                  <span className="mt-1 block text-sm">Not walked</span>
                ) : (
                  <>
                    <span className="mt-1 flex items-center gap-1.5 text-sm">
                      <StatusDot state={cell.state} />
                      {CELL_STATE_LABELS[cell.state]} · {cell.screenCount} {cell.screenCount === 1 ? "screen" : "screens"}
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {cell.state === "thin" ? `${cell.obsCount} ${cell.obsCount === 1 ? "observation" : "observations"}` : `${cell.ageDays}d · b${cell.build}`}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted">Screens by phase</h2>
      {e.phaseListing.map((p) => (
        <div key={p.phase} className="mb-4">
          <div className="mb-2 text-xs font-semibold text-muted">{p.phase}</div>
          <div className="flex flex-wrap gap-2">
            {p.screens.map((s) => (
              <Link key={s.key} to="screen" param={s.key}
                className="rounded-xl bg-surface-secondary px-3 py-2 text-sm text-foreground no-underline">
                <NamedScreen screen={s} />
                {s.kind === "OVERLAY" && <span className="ml-1.5 text-[10px] text-muted">overlay</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

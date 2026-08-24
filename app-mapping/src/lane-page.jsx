import {useMemo} from "react";
import {Button} from "@heroui/react";
import {laneEntity} from "./entity-view.js";
import {Link} from "./link.jsx";
import {CatalogList, CatalogRow, EmptyPanel, PAGE, PageHeader, StatCards, freshness} from "./ui.jsx";

export function LanePage({id, navigate}) {
  const e = useMemo(() => laneEntity(id, new Date()), [id]);
  if (!e) {
    return (
      <div className={PAGE}>
        <EmptyPanel
          icon="layers-3-diagonal"
          title="Unknown lane"
          description={`No lane "${id}" exists.`}
          action={<Link to="lanes">Browse Lanes</Link>}
        />
      </div>
    );
  }
  return (
    <div className={PAGE}>
      <PageHeader
        chip={e.lane.surface}
        chipColor="accent"
        id={e.lane.id}
        title={`${e.lane.container} · ${e.lane.platform}`}
        description={e.lane.description}
      />
      <StatCards items={[
        {label: "Journeys", value: e.kpis.journeyCount, note: "observed here", tone: "text-muted"},
        {label: "Screens", value: e.kpis.screenCount, note: "on this lane", tone: "text-muted"},
        {label: "Builds", value: e.kpis.buildCount, note: "seen in walks", tone: "text-muted"},
        {label: "Freshness", value: e.kpis.latestBuild ? `b${e.kpis.latestBuild}` : "—",
          note: e.kpis.ageDays != null ? `${e.kpis.ageDays}d ago` : "not observed",
          tone: e.kpis.latestBuild ? "text-success" : "text-muted"},
      ]} />
      {e.journeys.length === 0 ? (
        <div className="mt-10">
          <EmptyPanel
            icon="map-pin"
            title="Not walked"
            description="This lane is not in the crawl set — no journey has an observation here. Its existence requires seeded flows for this lane and a completed capture."
          />
        </div>
      ) : (
        <CatalogList title="Journeys in this lane" meta={`${e.journeys.length} observed`}>
          {e.journeys.map((j) => (
            <CatalogRow
              key={j.journey.id}
              to="journey"
              param={j.journey.id}
              chip={j.journey.team}
              chipColor="accent"
              title={j.journey.label}
              description={j.journey.description}
              meta={`${j.obsCount} observations`}
              trailing={freshness(j.latestBuild, j.ageDays)}
              action={
                <Button size="sm" variant="secondary" onPress={() => navigate({path: "/map", patch: {
                  journey: j.journey.id,
                  container: e.lane.container.toLowerCase(), platform: e.lane.platform.toLowerCase(),
                  cohort: "new", locale: "en-US", market: "US", build: j.latestBuild}})}>
                  Open in console
                </Button>
              }
            />
          ))}
        </CatalogList>
      )}
    </div>
  );
}

import {useMemo} from "react";
import {Button} from "@heroui/react";
import {laneRows} from "./catalog-view.js";
import {MAP_VERSION} from "./fixtures.js";
import {CatalogList, CatalogRow, GIcon, PAGE, PageHeader, StatCards, freshness} from "./ui.jsx";

export function LanesCatalog({navigate}) {
  const rows = useMemo(() => laneRows(new Date()), []);
  const observed = rows.filter((r) => r.observed).length;
  const screens = rows.reduce((n, r) => n + r.screenCount, 0);

  return (
    <div className={PAGE}>
      <PageHeader
        chip="Published map"
        id={`v${MAP_VERSION}`}
        title="Lanes"
        description="A lane is a container × platform the crawler walks. Observation is exact — a lane with no walk is shown as not walked, never inferred."
        actions={
          <Button size="sm" variant="primary" onPress={() => navigate({path: "/ask", patch: {}})}>
            <GIcon name="magnifier" size={16} />
            Ask the Map
          </Button>
        }
      />
      <StatCards items={[
        {label: "Lanes", value: rows.length, note: "in the published map", tone: "text-muted"},
        {label: "Observed", value: observed, note: "have a walk", tone: "text-success"},
        {label: "Not walked", value: rows.length - observed, note: "no observation", tone: "text-muted"},
        {label: "Screens", value: screens, note: "across observed lanes", tone: "text-muted"},
      ]} />
      <CatalogList title="All lanes" meta={`${observed} of ${rows.length} observed`}>
        {rows.map((r) => (
          <CatalogRow
            key={r.lane.id}
            to="lane"
            param={r.lane.id}
            chip={r.observed ? "Observed" : "Not walked"}
            chipColor={r.observed ? "success" : "default"}
            title={`${r.lane.container} · ${r.lane.platform}`}
            description={r.lane.description}
            meta={r.observed
              ? `${r.lane.surface} · ${r.journeyCount} journeys · ${r.screenCount} screens`
              : `${r.lane.surface} · not in the crawl set`}
            trailing={r.observed ? freshness(r.latestBuild, r.ageDays) : "—"}
          />
        ))}
      </CatalogList>
    </div>
  );
}

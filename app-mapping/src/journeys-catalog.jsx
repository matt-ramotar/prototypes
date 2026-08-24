import {useMemo} from "react";
import {Button} from "@heroui/react";
import {journeyRows} from "./catalog-view.js";
import {MAP_VERSION} from "./fixtures.js";
import {CatalogList, CatalogRow, GIcon, PAGE, PageHeader, StatCards, freshness} from "./ui.jsx";

export function JourneysCatalog({navigate}) {
  const rows = useMemo(() => journeyRows(new Date()), []);
  const screens = rows.reduce((n, r) => n + r.screenCount, 0);
  const teams = new Set(rows.map((r) => r.journey.team)).size;
  const freshest = rows.reduce((best, r) => {
    if (r.ageDays == null) return best;
    if (best == null || r.ageDays < best.ageDays) return r;
    return best;
  }, null);

  return (
    <div className={PAGE}>
      <PageHeader
        chip="Published map"
        id={`v${MAP_VERSION}`}
        title="Journeys"
        description="A journey is a named walk through the product. Each row is observed on the lanes the crawler has already been, never projected onto a lane it has not walked."
        actions={
          <Button size="sm" variant="primary" onPress={() => navigate({path: "/ask", patch: {}})}>
            <GIcon name="magnifier" size={16} />
            Ask the Map
          </Button>
        }
      />
      <StatCards items={[
        {label: "Journeys", value: rows.length, note: "in the published map", tone: "text-muted"},
        {label: "Screens", value: screens, note: "across all journeys", tone: "text-muted"},
        {label: "Teams", value: teams, note: "owning a journey", tone: "text-muted"},
        {label: "Freshest", value: freshest ? freshness(freshest.latestBuild, freshest.ageDays) : "—",
          note: freshest?.journey.label, tone: "text-success"},
      ]} />
      <CatalogList title="All journeys" meta={`${rows.length} published`}>
        {rows.map((r) => (
          <CatalogRow
            key={r.journey.id}
            to="journey"
            param={r.journey.id}
            chip={r.journey.team}
            chipColor="accent"
            title={r.journey.label}
            description={r.journey.description}
            meta={`${r.journey.phases.join(" → ")} · ${r.screenCount} screens · ${r.laneCount} ${r.laneCount === 1 ? "lane" : "lanes"}`}
            trailing={freshness(r.latestBuild, r.ageDays)}
          />
        ))}
      </CatalogList>
    </div>
  );
}

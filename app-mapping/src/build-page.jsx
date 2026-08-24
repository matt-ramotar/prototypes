import {Button} from "@heroui/react";
import {useMemo} from "react";
import {comparePatch} from "./catalog-view.js";
import {buildEntity} from "./entity-view.js";
import {Link} from "./link.jsx";
import {CatalogList, CatalogRow, EmptyPanel, PAGE, PageHeader, StatCards} from "./ui.jsx";

export function BuildPage({id, navigate}) {
  const e = useMemo(() => buildEntity(id, new Date()), [id]);
  if (!e) {
    return (
      <div className={PAGE}>
        <EmptyPanel
          icon="cube"
          title="Unknown build"
          description={`Build "${id}" has no observations in the published map.`}
          action={<Link to="builds">Browse Builds</Link>}
        />
      </div>
    );
  }
  const screens = e.observed.reduce((n, o) => n + o.screenCount, 0);
  return (
    <div className={PAGE}>
      <PageHeader
        chip={e.prevBuild ? "Comparable" : "Earliest"}
        id={e.window.first ? `${e.window.first.slice(0, 10)} → ${e.window.last?.slice(0, 10)}` : null}
        title={<span className="font-mono">b{e.build}</span>}
        description="Observations on this build, and the Givens that can be compared with the previous walk. Nothing is inferred across a Given the crawler did not see on both builds."
        actions={e.prevBuild ? (
          <Button size="sm" variant="primary" onPress={() => navigate({path: "/map",
            patch: comparePatch(e.build, e.prevBuild)})}>
            Compare with b{e.prevBuild}
          </Button>
        ) : null}
      />
      <StatCards items={[
        {label: "Observations", value: e.kpis.observationCount, note: "on this build", tone: "text-muted"},
        {label: "Lanes", value: e.kpis.laneCount, note: "walked", tone: "text-muted"},
        {label: "Journeys", value: e.kpis.journeyCount, note: "with a walk", tone: "text-muted"},
        {label: "Screens", value: screens, note: "across Givens", tone: "text-muted"},
      ]} />
      <CatalogList title="What this build observed" meta={`${e.observed.length} Givens`}>
        {e.observed.map((o) => (
          <CatalogRow
            key={o.runId}
            to="journey"
            param={o.journey.id}
            chip={`${o.lane.container} · ${o.lane.platform}`}
            chipColor="accent"
            title={o.journey.label}
            meta={`${o.market} · ${o.locale} · ${o.screenCount} ${o.screenCount === 1 ? "screen" : "screens"} · ${o.runId}`}
            trailing={o.observedAt?.slice(0, 10)}
          />
        ))}
      </CatalogList>
    </div>
  );
}

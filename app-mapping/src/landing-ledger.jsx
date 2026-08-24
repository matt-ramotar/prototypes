import {Button, Card, Chip} from "@heroui/react";
import {Timeline} from "@heroui-pro/react/timeline";
import {JOURNEYS, LANES, MAP_VERSION} from "./fixtures.js";
import {buildLedger} from "./landing-view.js";
import {comparePatch} from "./catalog-view.js";
import {GIcon, NamedScreen, PAGE, PageHeader, StatCards} from "./ui.jsx";

const DATE = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short"});

function Movement({sign, label, items}) {
  const prefix = items.length === 0 ? "0" : `${sign === "add" ? "+" : sign === "remove" ? "−" : "~"}${items.length}`;
  const tone = items.length === 0 ? "text-muted" : sign === "add" ? "text-success" : sign === "remove" ? "text-danger" : "text-warning";
  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-sm font-semibold tabular-nums ${tone}`}>{prefix}</span>
        <span className="text-xs text-muted">{label}</span>
      </div>
      {items.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {items.map((s) => (
            <Chip key={s.key} size="sm" variant="secondary">
              <NamedScreen screen={s} />
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Entry({row, navigate, onDiff, isLatest}) {
  const moved = row.added.length + row.removed.length + row.changed.length;
  return (
    <Timeline.Item status={isLatest ? "current" : "default"}>
      <Timeline.Marker />
      <Timeline.Connector />
      <Timeline.Content>
        <Card className="gap-4 p-5">
          <Card.Header className="flex-row flex-wrap items-center gap-3 p-0">
            <Card.Title className="font-mono text-xl">b{row.build}</Card.Title>
            {isLatest ? <Chip size="sm" color="accent" variant="soft">newest</Chip> : null}
            <span className="text-xs text-muted">
              {row.lastObservedAt ? `observed ${DATE.format(new Date(row.lastObservedAt))}` : "no observations"}
              {row.ageDays != null ? ` · ${row.ageDays}d ago` : ""}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto"
              onPress={() => navigate({path: `/builds/${row.build}`, patch: {}})}>
              Open
              <GIcon name="arrow-right" size={13} />
            </Button>
          </Card.Header>
          <Card.Content className="gap-4 p-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Observations", row.observationCount],
                ["Lanes", `${row.laneIds.length}/${LANES.length}`],
                ["Journeys", `${row.journeyIds.length}/${JOURNEYS.length}`],
                ["Screens", row.screenCount],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-muted">{label}</div>
                  <div className="text-lg font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
            {row.prevBuild == null ? (
              <p className="text-sm text-muted">Earliest observed build — nothing before it to compare against.</p>
            ) : row.comparable === 0 ? (
              <p className="text-sm text-muted">
                No Given is observed on both b{row.build} and b{row.prevBuild}, so no build-over-build
                claim can be made.
              </p>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">
                    against <span className="font-mono">b{row.prevBuild}</span> ·{" "}
                    {row.comparable} {row.comparable === 1 ? "Given" : "Givens"} comparable
                  </span>
                  {moved > 0 ? (
                    <Button size="sm" variant="ghost" onPress={() => onDiff(row)}>
                      Open diff
                      <GIcon name="arrow-right" size={13} />
                    </Button>
                  ) : null}
                </div>
                {moved === 0 ? (
                  <p className="mt-2 text-sm text-muted">No screen appeared, vanished or changed.</p>
                ) : (
                  <>
                    <Movement sign="add" label="appeared" items={row.added} />
                    <Movement sign="remove" label="vanished" items={row.removed} />
                    <Movement sign="change" label="changed" items={row.changed} />
                  </>
                )}
              </div>
            )}
          </Card.Content>
        </Card>
      </Timeline.Content>
    </Timeline.Item>
  );
}

export function LedgerLanding({navigate, onNavigate, title = "Builds"}) {
  const rows = buildLedger(new Date());
  const totalObs = rows.reduce((n, r) => n + r.observationCount, 0);

  const onDiff = (row) => {
    const patch = comparePatch(row.build, row.prevBuild);
    if (!patch) return;
    if (onNavigate) onNavigate({...patch, go: true});
    else navigate({path: "/map", patch});
  };

  const latest = rows[0];

  return (
    <div className={PAGE}>
      <PageHeader
        chip="Ledger"
        id={`v${MAP_VERSION}`}
        title={title}
        description="Every build the crawler has walked, newest first. Movement is computed only across Givens observed on both builds — the map never infers a change it did not see."
      />
      <StatCards items={[
        {label: "Builds", value: rows.length, note: "observed", tone: "text-muted"},
        {label: "Observations", value: totalObs, note: "across the ledger", tone: "text-muted"},
        {label: "Newest", value: latest ? `b${latest.build}` : "—",
          note: latest?.ageDays != null ? `${latest.ageDays}d ago` : null, tone: "text-success"},
        {label: "Lanes on newest", value: latest ? `${latest.laneIds.length}/${LANES.length}` : "—",
          note: "walked this build", tone: "text-muted"},
      ]} />
      <Timeline className="mt-8" axis="start">
        {rows.map((row, i) => (
          <Entry key={row.build} row={row} navigate={navigate} onDiff={onDiff} isLatest={i === 0} />
        ))}
      </Timeline>
    </div>
  );
}

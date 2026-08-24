import {Button, Chip, Tabs} from "@heroui/react";
import {useMemo, useState} from "react";
import {BUILDS, SCREENS} from "./fixtures.js";
import {screenEntity} from "./entity-view.js";
import {WireScreenshot} from "./screenshot.jsx";
import {Link} from "./link.jsx";
import {CopyKey, EmptyPanel, NamedScreen, PAGE, PageHeader, StatCards, VARIANT_COLOR} from "./ui.jsx";

function SCREENSAFE(key) { return SCREENS[key] ?? {label: key, derivedLabel: key}; }

export function ScreenPage({screenKey, navigate}) {
  const now = useMemo(() => new Date(), []);
  const e = useMemo(() => screenEntity(screenKey, now), [screenKey, now]);
  const [buildIdx, setBuildIdx] = useState(BUILDS.length - 1);

  if (!e) {
    return (
      <div className={PAGE}>
        <EmptyPanel
          icon="square-dashed"
          title="Unknown screen key"
          description={`No screen in the published map has the key ${screenKey}.`}
          action={<Link to="screens">Browse the Screens catalog</Link>}
        />
      </div>
    );
  }

  const {screen, journey, kpis} = e;
  return (
    <div className={PAGE}>
      <PageHeader
        chip={screen.kind.toLowerCase()}
        chipColor={screen.kind === "OVERLAY" ? "warning" : "accent"}
        id={screen.key}
        title={<NamedScreen screen={screen} />}
        description={
          !screen.label && screen.suggestedLabel
            ? `Suggested “${screen.suggestedLabel}” — model-proposed, provisional. Naming flows through the registry. ${screen.phase} phase of ${journey.label}, owned by ${journey.team}.`
            : `${screen.phase} phase of ${journey.label} · owned by ${journey.team}`
        }
        actions={<CopyKey value={screen.key} />}
      />

      <StatCards items={[
        {label: "Observed in", value: kpis.laneCount, note: kpis.laneCount === 1 ? "lane" : "lanes", tone: "text-muted"},
        {label: "Compositions", value: kpis.compositionCount, note: kpis.compositionCount === 1 ? "distinct stack" : "distinct stacks", tone: "text-muted"},
        {label: "Variant set", value: kpis.variantSet.length,
          note: kpis.variantSet.includes("ERROR") ? "includes ERROR" : kpis.variantSet.join(" · ") || "—",
          tone: kpis.variantSet.includes("ERROR") ? "text-danger" : "text-muted"},
        {label: "Freshness", value: kpis.latestBuild ? `b${kpis.latestBuild}` : "—",
          note: kpis.ageDays != null ? `${kpis.ageDays}d ago` : "not observed",
          tone: kpis.latestBuild ? "text-success" : "text-muted"},
      ]} />

      <Tabs className="mt-8" aria-label="Screen detail" variant="secondary">
        <Tabs.ListContainer>
          <Tabs.List>
            <Tabs.Tab id="overview">Overview<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="variants">Variants<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="edges">Edges<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="captures">Captures<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="overview">
          <div className="flex flex-wrap gap-6 pt-6">
            <div>
              <WireScreenshot screenKey={screen.key} variantSeed={BUILDS[buildIdx]} width={180} height={360} />
              <div className="mt-2 flex flex-wrap gap-1">
                {BUILDS.map((b, i) => (
                  <Button key={b} size="sm" variant={i === buildIdx ? "secondary" : "ghost"}
                    onPress={() => setBuildIdx(i)}>b{b}</Button>
                ))}
              </div>
              <p className="mt-2 max-w-[220px] text-xs text-muted">
                current + previous build kept hot; older tiers cold, never deleted
              </p>
            </div>
            <div className="min-w-[280px] flex-1">
              <div className="mb-2 text-xs font-medium text-muted">Observed compositions</div>
              {e.compositions.map((c) => (
                <ol key={c.signature} className="mb-2 list-decimal rounded-xl bg-surface-secondary px-6 py-2 text-sm">
                  {c.stack.map((n) => (
                    <li key={n.key}>
                      <NamedScreen screen={n} />
                      {c.occluded.includes(n.key) && <span className="text-muted"> · occluded</span>}
                      {n.kind === "SCREEN" && <span className="text-muted"> · base</span>}
                    </li>
                  ))}
                </ol>
              ))}
              <div className="mt-4 mb-2 text-xs font-medium text-muted">Appears in</div>
              {e.appearsIn.map((a) => (
                <div key={a.runId} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                  <span>{a.lane.container} · {a.lane.platform}</span>
                  <span className="font-mono text-xs text-muted">
                    {a.market} · {a.locale} · b{a.build}
                  </span>
                  <Button size="sm" variant="ghost" onPress={() => navigate({path: "/map", patch: {
                    journey: screen.journeyId, container: a.lane.container.toLowerCase(),
                    platform: a.lane.platform.toLowerCase(), cohort: a.cohort, locale: a.locale,
                    market: a.market, build: a.build, screen: screen.key}})}>
                    Open in console
                  </Button>
                </div>
              ))}
              <p className="mt-4 border-t border-separator pt-2 text-xs text-muted">
                Pulse signals — slot reserved (PR11) · empty in v1
              </p>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="variants">
          <div className="flex flex-wrap gap-4 pt-6">
            {kpis.variantSet.length === 0 && (
              <p className="text-sm text-muted">
                No variants observed — this node was never a base screen in any walk (overlays carry no variant sets).
              </p>
            )}
            {kpis.variantSet.map((v) => (
              <div key={v} className="text-center">
                <WireScreenshot screenKey={screen.key} variantSeed={v} width={100} height={200} />
                <div className="mt-2">
                  <Chip size="sm" color={VARIANT_COLOR[v] ?? "default"} variant={VARIANT_COLOR[v] ? "soft" : "secondary"}>
                    {v}
                  </Chip>
                </div>
              </div>
            ))}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="edges">
          <ul className="list-disc pt-6 pl-5 text-sm">
            {[...e.edgesIn.map((x) => ({...x, dir: "in", other: x.from})),
              ...e.edgesOut.map((x) => ({...x, dir: "out", other: x.to}))].map((x, i) => (
              <li key={i} className="mb-1.5">
                {x.dir} · {x.role.toLowerCase()} {x.dir === "in" ? "from" : "to"}{" "}
                <Link to="screen" param={x.other}>
                  <NamedScreen screen={SCREENSAFE(x.other)} />
                </Link>
                {!x.traversable && <span className="text-danger"> · non-traversable</span>}
              </li>
            ))}
          </ul>
        </Tabs.Panel>

        <Tabs.Panel id="captures">
          <div className="space-y-2 pt-6 text-sm">
            {e.captures.map((c) => (
              <div key={c.runId} className="flex flex-wrap gap-4 rounded-xl bg-surface-secondary px-4 py-3">
                <span className="font-mono">b{c.build}</span>
                <span>{c.laneId}</span>
                <span className="text-muted">{c.market} · {c.locale}</span>
                <span className="font-mono text-muted">{c.runId}</span>
                <span className="font-mono text-muted">{c.observedAt.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

import {Alert, Button, ScrollShadow} from "@heroui/react";
import {Segment} from "@heroui-pro/react/segment";
import {QueryPills} from "./pills.jsx";
import {ScreenCard} from "./screen-card.jsx";
import {EvidenceFrame} from "./landing-evidence.jsx";
import {SCREENS} from "./fixtures.js";
import {groupStepsByPhase} from "./reel-view.js";
import {EmptyPanel, NamedScreen, PAGE, PAGE_WIDE, StatusDot} from "./ui.jsx";

function VerdictLine({answer}) {
  const {screens, overlays, permissionPrompts} = answer.counts;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-foreground">
        <b>{screens}</b> {screens === 1 ? "screen" : "screens"}
        <span className="mx-2 text-muted">·</span>
        <b>{overlays}</b> {overlays === 1 ? "overlay" : "overlays"}
        {permissionPrompts > 0 && (
          <>
            <span className="mx-2 text-muted">·</span>
            <b>{permissionPrompts}</b> {permissionPrompts === 1 ? "permission screen" : "permission screens"}
          </>
        )}
      </p>
      <p className="font-mono text-sm text-muted">
        b{answer.given.build} · observed {answer.ageDays}d ago · {answer.obsCount} obs · {answer.runId}
      </p>
      <p className="text-sm text-muted">
        {answer.frame} · <span className="font-mono">map v{answer.mapVersion}</span>
      </p>
      {answer.thin && (
        <p className="flex items-center gap-2 text-sm text-warning">
          <StatusDot state="thin" />
          Resting on {answer.obsCount} {answer.obsCount === 1 ? "observation" : "observations"} — treat as provisional
        </p>
      )}
    </div>
  );
}

function OffSpine({item}) {
  const screen = SCREENS[item.key];
  return (
    <div className="mt-2 max-w-[168px] rounded-lg bg-danger/10 px-2 py-1.5 text-[10.5px] leading-snug text-danger">
      <NamedScreen screen={screen} /> · {item.role.toLowerCase()}
      <span className="block opacity-75">non-traversable · shown, never planned through</span>
    </div>
  );
}

export function ReelBody({answer, onOpenScreen}) {
  const byPhase = groupStepsByPhase(answer.steps, answer.journey.phases);

  return (
    <ScrollShadow orientation="horizontal" className="overflow-x-auto">
      <div className="flex items-start gap-4 pb-2">
        {byPhase.map((group, gi) => (
          <div key={group.phase} className="flex shrink-0 gap-3">
            {gi > 0 && <span className="mt-[86px] text-muted" aria-hidden>→</span>}
            <div>
              <div className="mb-3 border-b border-border pb-1.5 text-xs font-semibold text-muted">{group.phase}</div>
              <div className="flex items-start gap-3">
                {group.steps.map((step) => (
                  <div key={step.index}>
                    <ScreenCard step={step} answer={answer} onOpen={onOpenScreen} />
                    {answer.offSpine.filter((o) => o.afterIndex === step.index).map((o) => (
                      <OffSpine key={o.key} item={o} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollShadow>
  );
}

const REASON_COPY = {
  "lane-not-in-crawl-set": "This lane is not in the crawl set. No observation exists for any journey here.",
  "journey-not-observed-in-lane": "This journey has no flows observed in this lane.",
  "context-not-observed-in-lane": "This journey is observed in this lane, but not for this cohort, locale, and market.",
};

export function ReelSurface({resolution, query, notes, onNavigate, onPivot, onOpenScreen}) {
  const header = (
    <>
      <QueryPills query={query} onNavigate={onNavigate} onPivot={onPivot} />
      {notes?.length ? (
        <Alert status="warning" className="mt-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{notes.join(" · ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </>
  );

  if (resolution.kind === "not-walked") {
    return (
      <div className={PAGE}>
        {header}
        <div className="mt-8">
          <EmptyPanel
            icon="map-pin"
            title="Not yet walked"
            description={`${REASON_COPY[resolution.reason] ?? REASON_COPY["context-not-observed-in-lane"]} Its existence requires a seeded flow for this journey in this lane and a completed capture.`}
            action={resolution.nearest ? (
              <Button size="sm" variant="secondary"
                onPress={() => onNavigate({...resolution.nearest, view: null, screen: null})}>
                Nearest observed: {resolution.nearest.container} · {resolution.nearest.platform} · {resolution.nearest.market}
              </Button>
            ) : null}
          />
        </div>
      </div>
    );
  }

  if (resolution.kind === "stale-candidate") {
    return (
      <div className={PAGE}>
        {header}
        <Alert status="warning" className="mt-6">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Requested <b className="font-mono">b{resolution.requestedBuild}</b> has no observations for this Given.
              Freshest is <b className="font-mono">b{resolution.candidate.given.build}</b> ({resolution.candidate.ageDays}d).
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary"
            onPress={() => onNavigate({build: resolution.candidate.given.build})}>
            Switch to b{resolution.candidate.given.build}
          </Button>
        </Alert>
      </div>
    );
  }

  const answer = resolution.answer;
  const view = query.view === "captures" ? "captures" : "route";
  return (
    <div className={PAGE_WIDE}>
      {header}
      <div className="mt-6 mb-4 flex flex-wrap items-start justify-between gap-4">
        <VerdictLine answer={answer} />
        <Segment size="sm" variant="ghost" selectedKey={view} aria-label="Answer view"
          onSelectionChange={(k) => onNavigate({view: String(k) === "captures" ? "captures" : null})}>
          <Segment.Item id="route">Route</Segment.Item>
          <Segment.Item id="captures">Captures</Segment.Item>
        </Segment>
      </div>
      {view === "captures" ? (
        <ScrollShadow orientation="horizontal" className="overflow-x-auto">
          <div className="flex gap-3">
            {answer.steps.map((step, i) => (
              <EvidenceFrame key={i} step={step}
                onOpen={() => onOpenScreen((step.stack[0] ?? step.baseScreen).key)} />
            ))}
          </div>
        </ScrollShadow>
      ) : (
        <ReelBody answer={answer} onOpenScreen={onOpenScreen} />
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
        <span className="text-xs font-medium">Reading</span>
        <span>Stack depth on the capture</span>
        <span className="text-danger">Red note — non-traversable</span>
        <span className="italic">Derived name (unnamed)</span>
        <span>Chips — observed variant set</span>
      </div>
    </div>
  );
}

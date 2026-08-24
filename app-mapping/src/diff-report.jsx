import {Alert, Button, Card, Chip, Disclosure} from "@heroui/react";
import {Segment} from "@heroui-pro/react/segment";
import {canonicalize, resolveAnswer} from "./query.js";
import {computeDiff} from "./diff.js";
import {counterpartQuery} from "./diff-view.js";
import {QueryPills} from "./pills.jsx";
import {ReelBody} from "./reel.jsx";
import {WireScreenshot} from "./screenshot.jsx";
import {EmptyPanel, NamedScreen, PAGE, PAGE_WIDE} from "./ui.jsx";

const BADGE = {
  "only-a": {color: "success", label: (a) => `Only in ${a}`},
  "only-b": {color: "default", label: (_a, b) => `Only in ${b}`},
  "changed": {color: "warning", label: () => "Changed"},
};

function Entry({entry, sideA, sideB, onOpenScreen}) {
  const spec = BADGE[entry.type];
  return (
    <Card className="mb-2 flex-row items-start gap-3 p-3">
      <Chip size="sm" color={spec.color} variant="soft">
        {spec.label(sideA, sideB)}
      </Chip>
      <div className="flex shrink-0 items-center gap-1.5">
        <WireScreenshot screenKey={entry.key} width={44} height={88} />
        {entry.type === "changed" && (
          <>
            <span className="text-muted" aria-hidden>→</span>
            <WireScreenshot screenKey={entry.key + "|b"} width={44} height={88} />
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold"><NamedScreen screen={entry.screen} /></div>
        <div className="font-mono text-xs text-muted">{entry.key}</div>
        <div className="mt-1 text-xs text-muted">
          {entry.type === "changed" ? entry.detail : entry.note}
        </div>
        {entry.type === "changed" && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Chip size="sm" variant="secondary">correspondence: {entry.basis}</Chip>
            <Chip size="sm" variant="secondary">confidence: {entry.confidence}</Chip>
          </div>
        )}
      </div>
      <Button size="sm" variant="ghost" className="self-center" onPress={() => onOpenScreen(entry.key)}>
        Open
      </Button>
    </Card>
  );
}

export function DiffSurface({query, notes, onNavigate, onPivot, onOpenScreen}) {
  const now = new Date();
  const qA = query;
  const qB = canonicalize(counterpartQuery(query)).query;
  const rA = resolveAnswer(qA, now), rB = resolveAnswer(qB, now);

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

  if (rA.kind !== "answer" || rB.kind !== "answer") {
    const missing = rA.kind !== "answer" ? qA : qB;
    return (
      <div className={PAGE}>
        {header}
        <div className="mt-8">
          <EmptyPanel
            icon="layers-3-diagonal"
            title="One side of this comparison is not observed"
            description={`${missing[query.pivot] ?? query.counterpart} has no observation for this Given. The diff needs both answers to exist — no substitution is made.`}
            action={
              <Button size="sm" variant="secondary"
                onPress={() => onNavigate({pivot: null, counterpart: null})}>
                Back to the answer
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const a = rA.answer, b = rB.answer;
  const d = computeDiff(a, b);
  const sideA = query.pivot === "build" ? `b${a.given.build}` : a.given[query.pivot === "market" ? "market" : query.pivot];
  const sideB = query.pivot === "build" ? `b${b.given.build}` : b.given[query.pivot === "market" ? "market" : query.pivot];
  const view = query.view ?? "report";

  return (
    <div className={PAGE_WIDE}>
      {header}
      <div className="mt-6 mb-4 flex flex-wrap items-end gap-6">
        {[["only in " + sideA, d.onlyA.length, "text-success"],
          ["only in " + sideB, d.onlyB.length, "text-accent"],
          ["changed", d.changed.length, "text-warning"],
          ["shared", d.shared.length, "text-muted"]].map(([label, n, color]) => (
          <div key={label}>
            <div className={`font-mono text-3xl font-semibold tabular-nums ${n === 0 ? "text-muted" : color}`}>{n}</div>
            <div className="text-sm text-muted">{label}</div>
          </div>
        ))}
        <div className="ml-auto">
          <Segment selectedKey={view} onSelectionChange={(k) => onNavigate({view: String(k)})}
            aria-label="Diff view">
            <Segment.Item id="report">Report</Segment.Item>
            <Segment.Item id="reel-a">Reel · {sideA}</Segment.Item>
            <Segment.Item id="reel-b">Reel · {sideB}</Segment.Item>
          </Segment>
        </div>
      </div>

      {view === "report" && (
        <>
          {d.byPhase.map((group) => (
            <div key={group.phase} className="mt-3 border-t border-separator pt-2">
              <div className="mb-2 text-xs font-semibold text-muted">{group.phase}</div>
              {group.entries.map((e) => (
                <Entry key={e.type + e.key} entry={e} sideA={sideA} sideB={sideB} onOpenScreen={onOpenScreen} />
              ))}
            </div>
          ))}
          <Disclosure>
            <Disclosure.Heading>
              <Disclosure.Trigger>
                {d.shared.length} shared {d.shared.length === 1 ? "screen" : "screens"} — identical keys, both sides
                <Disclosure.Indicator />
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body>
                <ul className="list-disc pl-5 font-mono text-xs text-muted">
                  {d.shared.map((s) => (
                    <li key={s.key}><NamedScreen screen={s.screen} /> · {s.key}</li>
                  ))}
                </ul>
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </>
      )}
      {view === "reel-a" && <ReelBody answer={a} onOpenScreen={onOpenScreen} />}
      {view === "reel-b" && <ReelBody answer={b} onOpenScreen={onOpenScreen} />}
    </div>
  );
}

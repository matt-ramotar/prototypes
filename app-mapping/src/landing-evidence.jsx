import {Chip, ScrollShadow} from "@heroui/react";
import {BUILDS, FACETS, LANES} from "./fixtures.js";
import {coverage, journeyStrips} from "./landing-view.js";
import {WireScreenshot} from "./screenshot.jsx";
import {Sentence, SentenceLead, Token} from "./given.jsx";
import {GIcon, NamedScreen, PAGE_WIDE, StatusDot} from "./ui.jsx";

export function EvidenceFrame({step, onOpen}) {
  const base = step.baseScreen;
  const overlay = step.stack.length > 1 ? step.stack[0] : null;
  const variant = step.variants.find((v) => v !== "POPULATED") ?? step.variants[0];
  return (
    <button type="button" className="flex w-[78px] shrink-0 flex-col gap-1.5 text-left"
      onClick={onOpen}
      title={`${base.label ?? base.derivedLabel} · ${base.phase}`}>
      <span className="relative block">
        <WireScreenshot screenKey={overlay ? overlay.key : base.key} width={78} height={156}
          kind={overlay ? "OVERLAY" : "SCREEN"} variant={variant} />
        {step.stack.length > 1 ? <span className="am-stack-badge">{step.stack.length}</span> : null}
      </span>
      <span className="text-[11px] font-medium leading-snug">
        <NamedScreen screen={overlay ?? base} />
      </span>
      <span className="text-[10px] text-muted">{base.phase}</span>
    </button>
  );
}

function Strip({strip, onOpenJourney, onOpenScreen}) {
  const {journey, lane, answer, ageDays, state} = strip;
  return (
    <section className="mt-8">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <button type="button" className="inline-flex items-center gap-1.5 text-[15px] font-semibold"
          onClick={() => onOpenJourney(strip)}>
          {journey.label}
          <GIcon name="arrow-right" size={13} className="text-muted" />
        </button>
        {answer ? (
          <>
            <Chip size="sm" variant="secondary">{lane.container} · {lane.platform}</Chip>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <StatusDot state={answer.thin ? "thin" : state} />
              <span className="font-mono tabular-nums">
                b{answer.given.build} · {ageDays}d · {answer.obsCount} obs
              </span>
            </span>
            <span className="ml-auto font-mono text-sm text-muted">
              {answer.counts.screens} screens · {answer.counts.overlays} overlays
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <StatusDot state="none" /> not walked in this Given
          </span>
        )}
      </header>
      {answer ? (
        <ScrollShadow orientation="horizontal" className="overflow-x-auto">
          <div className="flex items-start gap-3 pb-1.5">
            {answer.steps.map((step, i) => (
              <EvidenceFrame key={i} step={step} onOpen={() => onOpenScreen(strip, step)} />
            ))}
          </div>
        </ScrollShadow>
      ) : (
        <p className="max-w-[62ch] rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
          No walk exists for this journey under the current Given. Its existence
          requires a seeded flow and a completed capture.
        </p>
      )}
    </section>
  );
}

export function EvidenceWallLanding({query, onNavigate}) {
  const now = new Date();
  const context = {
    cohort: query.cohort ?? "new",
    locale: query.locale ?? "en-US",
    market: query.market ?? "US",
    build: query.build ?? BUILDS.at(-1),
  };
  const strips = journeyStrips(context, now);
  const cov = coverage(context, now);
  const set = (patch) => onNavigate({...context, ...patch});
  const open = (strip, extra = {}) => onNavigate({
    ...context,
    journey: strip.journey.id,
    container: strip.lane.container.toLowerCase(),
    platform: strip.lane.platform.toLowerCase(),
    build: strip.answer.given.build,
    go: true,
    ...extra,
  });

  return (
    <div className={PAGE_WIDE}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Sentence>
          <SentenceLead>Given</SentenceLead>
          <Token value={context.cohort} options={FACETS.cohort} onSelect={(v) => set({cohort: v})} />
          <Token value={context.market} options={FACETS.market} onSelect={(v) => set({market: v})} />
          <Token value={context.locale} options={FACETS.locale} onSelect={(v) => set({locale: v})} mono />
          <Token value={`b${context.build}`} mono
            options={BUILDS.map((b) => ({id: b, label: `b${b}`}))}
            onSelect={(v) => set({build: v})} />
        </Sentence>
        <span className="font-mono text-sm text-muted">
          {cov.screens} screens · {cov.observed}/{cov.total} pairs observed
        </span>
      </div>

      {strips.map((s) => (
        <Strip key={s.journey.id} strip={s}
          onOpenJourney={(st) => (st.answer ? open(st) : null)}
          onOpenScreen={(st, step) => open(st, {screen: step.stack[0].key})} />
      ))}

      <p className="mt-7 max-w-prose text-sm text-muted">
        Each strip is the freshest observed walk for that journey under this Given —
        the lane shown is the one that carries it. Captures are deterministic
        wireframes standing in for the real thumbnails; every other number is read
        from the published map.
      </p>
    </div>
  );
}

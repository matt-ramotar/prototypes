// The Review surface, Linear-review IA: a narrow index of proposals on the
// left, the focused proposal's evidence given the full right pane — always
// visible, never behind a panel. Follow-up chat is a floating window that
// minimizes to a docked chip. Plain words throughout: approve, send back,
// reject.

import {useEffect, useMemo, useRef, useState} from "react";
import {Alert, Button, Kbd, Modal} from "@heroui/react";
import {ChainOfThought} from "@heroui-pro/react/chain-of-thought";
import {ChatMessage} from "@heroui-pro/react/chat-message";
import {PromptInput} from "@heroui-pro/react/prompt-input";
import {SCREENS} from "./fixtures.js";
import {REJECT_REASONS} from "./proposal-fixtures.js";
import {
  canAccept, chatReply, confidenceOf, docketOf, docketOrder, guideProse,
  nextUnjudged, progressOf, questionsFor, reasoningSteps, receiptOf,
  yamlDiff, yamlFileFor,
} from "./review-view.js";
import {VerdictGlyph, verdictMeta} from "./review-bits.jsx";
import {WireScreenshot} from "./screenshot.jsx";
import {GIcon, NamedScreen, PAGE_WIDE, PageHeader} from "./ui.jsx";

const screenName = (key) => SCREENS[key]
  ? (SCREENS[key].label ?? SCREENS[key].derivedLabel)
  : key.split("#")[0];

/** Approval is green — the one semantic color a verdict button carries. */
const GREEN = "bg-success text-success-foreground hover:bg-success/90";

const reasonLabel = (code) => REJECT_REASONS.find((r) => r.code === code)?.label ?? code;

const verdictLine = (record) =>
  `${verdictMeta(record).label}${record.reason ? ` — ${reasonLabel(record.reason).toLowerCase()}` : ""}`;

// -- left pane: the guide -----------------------------------------------------

function GuideCard({entity, record, viewed, focused, onFocus}) {
  const p = entity.proposal;
  return (
    <button type="button" data-section-id={p.id} onClick={onFocus}
      className={`flex w-full items-center gap-2.5 rounded-lg border border-separator bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-secondary/60
        ${focused ? "ring-1 ring-accent" : ""}`}>
      <VerdictGlyph record={record} viewed={viewed} />
      <span className={`min-w-0 flex-1 truncate text-sm ${record ? "text-muted" : ""}`}>
        {p.title}
      </span>
      {record ? <span className="shrink-0 text-xs text-muted">{verdictMeta(record).label}</span> : null}
    </button>
  );
}

/** A rejected proposal's card carries the system's reasoning, always visible. */
function RejectedCard({entity, record, focused, onFocus}) {
  const p = entity.proposal;
  const {reasons} = confidenceOf(entity);
  return (
    <button type="button" data-section-id={p.id} onClick={onFocus}
      className={`flex w-full flex-col gap-0.5 rounded-lg border border-separator px-3 py-2 text-left opacity-70 transition-opacity hover:opacity-100
        ${focused ? "opacity-100 ring-1 ring-accent" : ""}`}>
      <span className="flex items-center gap-2.5">
        <span className="w-4 text-center font-mono text-sm text-muted">✕</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{p.title}</span>
        {record ? <span className="shrink-0 text-xs text-muted">{verdictMeta(record).label}</span> : null}
      </span>
      <span className="pl-[26px] text-xs leading-relaxed text-muted">
        {reasons.join("; ")}
      </span>
    </button>
  );
}

// -- right pane: the evidence -------------------------------------------------

function FlaggedText({entity, text}) {
  const parts = text.split(/(?<=\.)\s+/);
  return parts.map((s, i) => {
    const sep = i < parts.length - 1 ? " " : "";
    return entity.overreach.includes(s)
      ? <mark key={i} className="rounded bg-warning/15 px-0.5 text-foreground underline decoration-warning decoration-dotted">{s}{sep}</mark>
      : <span key={i}>{s}{sep}</span>;
  });
}

function DetailPane({entity, record, onJudge, onReason, onRepair, onUndo, onAsk}) {
  if (!entity) return null;
  const p = entity.proposal;
  const v = entity.verification;
  const fixable = v.hops.find((h) => h.missingEdge && h.splice);
  const suggestions = questionsFor(entity);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-separator bg-surface p-6 text-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[220px] flex-1">
          <h3 className="text-lg font-semibold leading-snug">{p.title}</h3>
          {p.kind !== "new" && entity.target ? (
            <p className="mt-1 text-xs text-muted">
              {p.kind === "retire" ? "Removes" : "Changes"} the approved rule “{entity.target.title}”.
            </p>
          ) : null}
        </div>
        {!record ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="primary" className={GREEN}
              isDisabled={!canAccept(entity)} onPress={() => onJudge("accept")}>
              {p.kind === "retire" ? "Approve removal" : "Approve"}
              <Kbd variant="light"><Kbd.Content>a</Kbd.Content></Kbd>
            </Button>
            <Button size="sm" variant="secondary" onPress={() => onReason("changes")}>
              Send back<Kbd variant="light"><Kbd.Content>r</Kbd.Content></Kbd>
            </Button>
            <Button size="sm" variant="danger-soft" onPress={() => onReason("reject")}>
              Reject<Kbd variant="light"><Kbd.Content>x</Kbd.Content></Kbd>
            </Button>
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted">{verdictLine(record)}</span>
            <Button size="sm" variant="ghost" onPress={onUndo}>
              Undo<Kbd variant="light"><Kbd.Content>z</Kbd.Content></Kbd>
            </Button>
          </span>
        )}
      </div>
      {!record && !canAccept(entity) ? (
        <p className="-mt-3 text-xs text-danger">
          The map can't verify this route, so it can't be approved — fix it or send it back.
        </p>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Given</p>
        <p className="mt-1">
          {p.given.market} · {p.given.locale} · {p.given.cohort} user
          {Object.entries(p.given.flags ?? {}).map(([f, val]) => (
            <span key={f}> · <span className="font-mono text-xs font-semibold">{f} = {val}</span></span>
          ))}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">When</p>
        <div className="mt-1 flex flex-col">
          {v.hops.map((h) => (
            <div key={h.key} className="flex items-center gap-3 border-b border-separator py-2 last:border-0">
              {h.screen ? <WireScreenshot screenKey={h.key} width={26} height={48} kind={h.screen.kind} /> : null}
              <span className="min-w-0 flex-1">
                {h.screen ? <NamedScreen screen={h.screen} />
                  : <span className="text-danger">{h.key.split("#")[0]}</span>}
              </span>
              <span className="text-right text-xs">
                {h.unmapped ? <span className="text-danger">not on the map</span>
                  : h.missingEdge ? <span className="text-danger">step never seen</span>
                  : h.obsUnder === 0 ? <span className="text-warning">never seen with this given</span>
                  : <span className="text-muted">seen {h.obsUnder}×</span>}
              </span>
            </div>
          ))}
        </div>
        {fixable && !entity.amended ? (
          <Button size="sm" variant="secondary" className="mt-2" onPress={onRepair}>
            Fix the route via {screenName(fixable.splice)}
            <Kbd variant="light"><Kbd.Content>e</Kbd.Content></Kbd>
          </Button>
        ) : null}
        {entity.amended ? (
          <p className="mt-2 text-xs text-success">Route fixed in review — the edit stays on the record.</p>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Then</p>
        <ul className="mt-1 flex flex-col gap-1">
          {p.then.map((rule) => <li key={rule}>· {rule}</li>)}
        </ul>
        <p className="mt-1.5 text-xs italic text-muted">
          The map verified the route. Whether these rules are right is your call.
        </p>
      </div>

      <ChainOfThought defaultExpanded={entity.overreach.length > 0}>
        <ChainOfThought.Trigger>How the agent got here</ChainOfThought.Trigger>
        <ChainOfThought.Content>
          <ChainOfThought.Steps>
            {reasoningSteps(entity).map((step) => (
              <ChainOfThought.Step key={step.label} label={step.label}>
                {step.flagged ? <FlaggedText entity={entity} text={step.text} /> : step.text}
              </ChainOfThought.Step>
            ))}
          </ChainOfThought.Steps>
        </ChainOfThought.Content>
      </ChainOfThought>

      {entity.overlap ? (
        <p className="text-xs text-muted">
          {entity.overlap.suggestion === "duplicate"
            ? <>An approved rule already covers this: “{entity.overlap.req.title}”.</>
            : <>Related to the approved rule “{entity.overlap.req.title}”
                {entity.overlap.delta.length > 0
                  ? ` — differs only in ${entity.overlap.delta.map((d) => d.facet).join(", ")}.`
                  : " — only the rules differ."}</>}
        </p>
      ) : null}

      {p.kind === "retire" && entity.target?.referencedBy.length ? (
        <p className="text-xs text-warning">
          {entity.target.referencedBy.length} other approved {entity.target.referencedBy.length === 1 ? "rule depends" : "rules depend"} on
          this one — removing it sends them back for review.
        </p>
      ) : null}

      <div className="flex flex-col items-start gap-1 border-t border-separator pt-3">
        {suggestions.map((q) => (
          <Button key={q} size="sm" variant="ghost" className="justify-start text-muted"
            onPress={() => onAsk(q)}>
            <GIcon name="comment" size={13} />
            {q}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="justify-start text-muted" onPress={() => onAsk(null)}>
          <GIcon name="comment" size={13} />
          Ask about this…
          <Kbd variant="light"><Kbd.Content>↵</Kbd.Content></Kbd>
        </Button>
      </div>
    </div>
  );
}

// -- the floating chat window -------------------------------------------------

function ChatWindow({title, chat, suggestions, state, onAsk, onMinimize, onClose}) {
  const [draft, setDraft] = useState("");
  const bodyRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({top: bodyRef.current.scrollHeight});
  }, [chat.length]);

  if (state === "min") {
    return (
      <button type="button" onClick={onMinimize}
        className="fixed bottom-4 right-4 z-30 flex max-w-[320px] items-center gap-2 rounded-full border border-separator bg-overlay px-4 py-2 text-xs shadow-(--overlay-shadow)">
        <GIcon name="comment" size={13} className="shrink-0 text-muted" />
        <span className="truncate">{title}</span>
      </button>
    );
  }
  if (state !== "open") return null;

  return (
    <div className="fixed bottom-4 right-4 z-30 flex max-h-[70vh] w-[400px] flex-col rounded-2xl border border-separator bg-overlay shadow-(--overlay-shadow)">
      <header className="flex items-center gap-2 border-b border-separator px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <Button isIconOnly size="sm" variant="ghost" aria-label="Minimize" onPress={onMinimize}>
          <GIcon name="minus" size={14} className="text-muted" />
        </Button>
        <Button isIconOnly size="sm" variant="ghost" aria-label="Close" onPress={onClose}>
          <GIcon name="xmark" size={14} className="text-muted" />
        </Button>
      </header>
      <div ref={bodyRef} className="flex min-h-[120px] flex-col gap-3 overflow-y-auto p-4">
        {chat.length === 0 && suggestions.length > 0 ? (
          <div className="flex flex-col items-start gap-1">
            {suggestions.map((q) => (
              <Button key={q} size="sm" variant="ghost" className="justify-start text-muted"
                onPress={() => onAsk(q)}>
                {q}
              </Button>
            ))}
          </div>
        ) : null}
        {chat.map((m, i) => m.role === "user" ? (
          <ChatMessage.User key={i}>
            <ChatMessage.Bubble>
              <ChatMessage.Content>{m.text}</ChatMessage.Content>
            </ChatMessage.Bubble>
          </ChatMessage.User>
        ) : (
          <ChatMessage.Assistant key={i}>
            <ChatMessage.Body>
              {m.steps?.length ? (
                <ChainOfThought defaultExpanded={false}>
                  <ChainOfThought.Trigger>Worked it out</ChainOfThought.Trigger>
                  <ChainOfThought.Content>
                    <ChainOfThought.Steps>
                      {m.steps.map((s) => (
                        <ChainOfThought.Step key={s.label} label={s.label}>{s.text}</ChainOfThought.Step>
                      ))}
                    </ChainOfThought.Steps>
                  </ChainOfThought.Content>
                </ChainOfThought>
              ) : null}
              <ChatMessage.Content>{m.text}</ChatMessage.Content>
              <p className="text-xs text-muted">from the map's records · deterministic</p>
            </ChatMessage.Body>
          </ChatMessage.Assistant>
        ))}
      </div>
      <div className="border-t border-separator p-3">
        <PromptInput value={draft} onValueChange={setDraft}
          onSubmit={() => { const q = draft.trim(); if (q) { onAsk(q); setDraft(""); } }}>
          <PromptInput.Shell>
            <PromptInput.Content>
              <PromptInput.TextArea placeholder="Reply…" />
            </PromptInput.Content>
            <PromptInput.Toolbar>
              <PromptInput.ToolbarEnd>
                <PromptInput.Send aria-label="Send" />
              </PromptInput.ToolbarEnd>
            </PromptInput.Toolbar>
          </PromptInput.Shell>
        </PromptInput>
      </div>
    </div>
  );
}

function ReasonModal({pending, onPick, onClose}) {
  useEffect(() => {
    if (!pending) return;
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= REJECT_REASONS.length) {
        e.preventDefault();
        onPick(REJECT_REASONS[n - 1].code);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onPick]);
  if (!pending) return null;
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) onClose(); }} variant="blur">
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{pending.kind === "reject" ? "Why reject it?" : "Why send it back?"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-1.5">
            {REJECT_REASONS.map((r, i) => (
              <Button key={r.code} size="sm" variant="ghost" className="justify-start"
                onPress={() => onPick(r.code)}>
                <Kbd variant="light"><Kbd.Content>{i + 1}</Kbd.Content></Kbd>
                {r.label}
              </Button>
            ))}
            <p className="mt-1 text-xs text-muted">The agent reads your reason and adjusts.</p>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const isTyping = (el) =>
  el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

/** Linear-style edge marks: hover the Guide's left edge for the contents. */
function HoverToc({docket, entities, review, flowIds, rejectedIds, focusId, onJump}) {
  const tick = (id) => {
    const r = review.verdicts[id];
    if (!r) return focusId === id ? "bg-accent" : "bg-muted/50";
    return r.verdict === "accept" ? "bg-success"
      : r.verdict === "changes" ? "bg-warning" : "bg-danger";
  };
  return (
    <div className="group sticky top-36 z-20 hidden pr-3 lg:block">
      <div className="flex flex-col gap-1 py-2">
        {flowIds.map((id) => <span key={id} className={`h-0.5 w-3 rounded-full ${tick(id)}`} />)}
        {rejectedIds.map((id) => <span key={id} className="h-0.5 w-3 rounded-full bg-muted/25" />)}
      </div>
      <div className="absolute left-4 top-0 hidden max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-separator bg-overlay p-2 shadow-(--overlay-shadow) group-hover:block">
        {docket.map(({session, clusters, singletons}) => {
          const mine = [...clusters.flatMap((c) => c.items), ...singletons]
            .map((e) => e.proposal.id).filter((id) => flowIds.includes(id));
          if (mine.length === 0) return null;
          return (
            <div key={session.id} className="mb-1">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {session.title}
              </p>
              {flowIds.filter((id) => mine.includes(id)).map((id) => (
                <button key={id} type="button" onClick={() => onJump(id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs
                    hover:bg-surface-secondary ${focusId === id ? "bg-surface-secondary" : ""}`}>
                  <VerdictGlyph record={review.verdicts[id]} viewed={review.viewed.includes(id)} />
                  <span className="min-w-0 flex-1 truncate">{entities.get(id).proposal.title}</span>
                </button>
              ))}
            </div>
          );
        })}
        {rejectedIds.length > 0 ? (
          <div>
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Considered but rejected
            </p>
            {rejectedIds.map((id) => (
              <button key={id} type="button" onClick={() => onJump(id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs opacity-60 hover:bg-surface-secondary">
                <span className="w-4 text-center font-mono">✕</span>
                <span className="min-w-0 flex-1 truncate">{entities.get(id).proposal.title}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** What the agents propose — description only, no review state. */
function OverviewTab({docket, flowIds, rejectedIds}) {
  return (
    <div className="mt-8 flex max-w-xl flex-col gap-6">
      {docket.map(({session, clusters, singletons}) => {
        const mine = [...clusters.flatMap((c) => c.items), ...singletons];
        if (mine.length === 0) return null;
        const sources = [...new Set(mine.map((e) => e.proposal.source.ref))];
        return (
          <div key={session.id}>
            <p className="text-sm font-medium">{session.title}</p>
            <p className="mt-0.5 text-sm text-muted">
              {session.agent} proposes {mine.length} test {mine.length === 1 ? "rule" : "rules"},
              derived from {sources.join(", ")}.
            </p>
          </div>
        );
      })}
      {rejectedIds.length > 0 ? (
        <p className="text-sm text-muted">
          {rejectedIds.length} {rejectedIds.length === 1 ? "was" : "were"} considered and
          rejected by the system — the reasoning is recorded with each.
        </p>
      ) : null}
    </div>
  );
}

/** The artifact itself: each proposal as the yaml file diff approving applies. */
function DiffTab({entities, allIds, rejectedIds}) {
  return (
    <div className="mt-8 flex max-w-3xl flex-col gap-6">
      {allIds.map((id) => {
        const e = entities.get(id);
        const lines = yamlDiff(e);
        const adds = lines.filter((l) => l.sign === "+").length;
        const dels = lines.filter((l) => l.sign === "-").length;
        return (
          <div key={id}
            className={`overflow-hidden rounded-xl border border-separator ${rejectedIds.includes(id) ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-3 border-b border-separator bg-surface px-4 py-2.5">
              <GIcon name="file-text" size={14} className="text-muted" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {yamlFileFor(e.proposal)}
              </span>
              <span className="font-mono text-xs">
                {adds > 0 ? <span className="text-success">+{adds}</span> : null}{" "}
                {dels > 0 ? <span className="text-danger">−{dels}</span> : null}
              </span>
            </div>
            <div className="overflow-x-auto py-1 font-mono text-xs leading-relaxed">
              {lines.map((l, i) => (
                <div key={i} className={`flex ${l.sign === "+" ? "bg-success/10"
                  : l.sign === "-" ? "bg-danger/10" : ""}`}>
                  <span className="w-10 shrink-0 select-none pr-2 text-right text-muted/60">{i + 1}</span>
                  <span className={`w-4 shrink-0 select-none ${l.sign === "+" ? "text-success"
                    : l.sign === "-" ? "text-danger" : "text-muted/40"}`}>{l.sign}</span>
                  <span className="whitespace-pre">{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReviewSurface({review, dispatch, focusParam = null}) {
  const docket = useMemo(() => docketOf(review.amendments), [review.amendments]);
  const entities = useMemo(() =>
    new Map(docket.flatMap((s) => [...s.clusters.flatMap((c) => c.items), ...s.singletons]
      .map((e) => [e.proposal.id, e]))), [docket]);
  const allIds = useMemo(() => docketOrder(docket), [docket]);
  // The system's triage: only highest-confidence proposals enter the flow;
  // the rest are considered-but-rejected, reasoning attached.
  const flowIds = useMemo(() =>
    allIds.filter((id) => confidenceOf(entities.get(id)).confident),
    [allIds, entities]);
  const rejectedIds = useMemo(() =>
    allIds.filter((id) => !confidenceOf(entities.get(id)).confident),
    [allIds, entities]);

  const [focusId, setFocusId] = useState(() => focusParam ?? flowIds[0] ?? null);
  const [pending, setPending] = useState(null);
  const [tab, setTab] = useState("review");
  const [submitted, setSubmitted] = useState(false);
  // The floating chat binds to the proposal it was opened for.
  const [chats, setChats] = useState({});
  const [chatFor, setChatFor] = useState(null);
  const [chatState, setChatState] = useState("closed"); // open | min | closed
  const scrollPrimed = useRef(false);
  const progress = progressOf(review, flowIds);
  const receipt = receiptOf(review, allIds);

  useEffect(() => {
    if (!focusId) return;
    dispatch({type: "view", id: focusId});
    const el = document.querySelector(`[data-section-id="${focusId}"]`);
    if (el) el.scrollIntoView({block: scrollPrimed.current ? "nearest" : "center"});
    scrollPrimed.current = true;
  }, [focusId, dispatch]);

  const judge = (id, verdict, reason = null) => {
    dispatch({type: "judge", id, verdict, reason});
    setPending(null);
    const next = nextUnjudged(review, flowIds, id);
    if (next) setFocusId(next);
  };
  const repair = (id) => {
    const entity = entities.get(id);
    const broken = entity?.verification.hops.find((h) => h.missingEdge && h.splice);
    if (!broken) return;
    const route = [...entity.route];
    route.splice(route.indexOf(broken.key), 0, broken.splice);
    dispatch({type: "amend", id, patch: {route}});
  };
  const openChat = (id, question = null) => {
    setChatFor(id);
    setChatState("open");
    if (question) ask(id, question);
  };
  const ask = (id, question) => setChats((prev) => ({
    ...prev,
    [id]: [...(prev[id] ?? []),
      {role: "user", text: question},
      {role: "assistant", ...chatReply(entities.get(id), question)}],
  }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(document.activeElement)) return;
      if (e.key === "Escape" && chatState === "open") {
        e.preventDefault(); setChatState("min"); return;
      }
      if (document.querySelector("[role='dialog']")) return;
      if (tab !== "review") return;
      const at = flowIds.indexOf(focusId);
      const down = e.key === "ArrowDown" || e.key === "Down";
      const up = e.key === "ArrowUp" || e.key === "Up";
      if (down || up) {
        e.preventDefault();
        const from = at === -1 ? 0 : (at + (down ? 1 : flowIds.length - 1)) % flowIds.length;
        setFocusId(flowIds[from]);
      } else if ((e.key === "Enter" || e.key === "o") && focusId) {
        e.preventDefault(); openChat(focusId);
      } else if (e.key === "a" && focusId) {
        const entity = entities.get(focusId);
        if (entity && !review.verdicts[focusId] && canAccept(entity)) {
          e.preventDefault(); judge(focusId, "accept");
        }
      } else if (e.key === "x" && focusId && !review.verdicts[focusId]) {
        e.preventDefault(); setPending({id: focusId, kind: "reject"});
      } else if (e.key === "r" && focusId && !review.verdicts[focusId]) {
        e.preventDefault(); setPending({id: focusId, kind: "changes"});
      } else if (e.key === "e" && focusId) { e.preventDefault(); repair(focusId); }
      else if (e.key === "z") { e.preventDefault(); dispatch({type: "undo"}); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const focusedEntity = focusId ? entities.get(focusId) : null;
  const chatEntity = chatFor ? entities.get(chatFor) : null;

  return (
    <div className={PAGE_WIDE}>
      <PageHeader
        chip="Validation"
        title="Review"
        description="Agents propose test rules. You approve what's right, send back what isn't."
      />

      <div className="sticky top-0 z-10 -mx-4 mt-6 flex items-center gap-2 border-b border-separator bg-background/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        {[["overview", "Overview"], ["review", "Guide"], ["changes", "Diff"]].map(([id, label]) => (
          <Button key={id} size="sm" variant={tab === id ? "secondary" : "ghost"}
            onPress={() => setTab(id)}>
            {label}
          </Button>
        ))}
        <span className="ml-auto flex items-center gap-3">
          {tab === "review" && progress.judged === 0 ? (
            <span className="hidden font-mono text-xs text-muted sm:inline">
              ↑ ↓ move · a approve · ↵ ask
            </span>
          ) : null}
          <span className="font-mono text-sm tabular-nums text-muted">
            {progress.judged} / {progress.total}
          </span>
          {submitted ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-success">
              <GIcon name="circle-check-fill" size={15} />
              Approved
            </span>
          ) : (
            <Button size="sm" variant="primary" className={GREEN}
              isDisabled={!progress.done} onPress={() => setSubmitted(true)}>
              Approve review
            </Button>
          )}
        </span>
      </div>

      {submitted ? (
        <Alert status="success" className="mt-6">
          <Alert.Content>
            <Alert.Title>Review approved</Alert.Title>
            <Alert.Description>
              {receipt.countersigned} approved{receipt.amended > 0 ? ` (${receipt.amended} edited)` : ""} ·{" "}
              {receipt.changes} sent back · {receipt.rejected} rejected
              {rejectedIds.length > 0 ? ` · ${rejectedIds.length} considered and rejected by the system` : ""}.
              The agents read your reasons and adjust.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab docket={docket} flowIds={flowIds} rejectedIds={rejectedIds} />
      ) : null}
      {tab === "changes" ? (
        <DiffTab entities={entities} allIds={allIds} rejectedIds={rejectedIds} />
      ) : null}

      <div className={tab === "review"
        ? "mt-6 flex flex-col gap-8 lg:grid lg:grid-cols-[16px_360px_minmax(0,1fr)] lg:items-start"
        : "hidden"}>
        <HoverToc docket={docket} entities={entities} review={review}
          flowIds={flowIds} rejectedIds={rejectedIds} focusId={focusId}
          onJump={(id) => setFocusId(id)} />
        <div>
          {(() => {
            const sections = docket.map(({session, clusters, singletons}) => ({
              session,
              ids: [...clusters.flatMap((c) => c.items), ...singletons]
                .map((e) => e.proposal.id).filter((id) => flowIds.includes(id)),
            })).filter((s) => s.ids.length > 0);
            return sections.map(({session, ids}, i) => {
              const sectionEntities = ids.map((id) => entities.get(id));
              const reviewed = ids.every((id) => review.verdicts[id]);
              return (
                <section key={session.id} className="mb-10">
                  <h2 className="text-base font-semibold leading-snug">{session.title}</h2>
                  <p className="mt-1 flex items-center gap-2 font-mono text-xs text-muted">
                    {String(i + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}
                    {reviewed ? (
                      <span className="flex items-center gap-1 text-success">
                        <GIcon name="circle-check-fill" size={12} />
                        Reviewed
                      </span>
                    ) : null}
                  </p>
                  {guideProse(session, sectionEntities).map((paragraph) => (
                    <p key={paragraph} className="mt-3 text-sm leading-relaxed">{paragraph}</p>
                  ))}
                  {(() => {
                    const rejectedHere = allIds.filter((id) =>
                      entities.get(id).proposal.sessionId === session.id &&
                      rejectedIds.includes(id)).length;
                    return rejectedHere > 0 ? (
                      <p className="mt-2 text-xs text-muted">
                        {rejectedHere} more from this session {rejectedHere === 1 ? "was" : "were"} considered
                        and rejected — see below.
                      </p>
                    ) : null;
                  })()}
                  <div className="mt-4 flex flex-col gap-1.5">
                    {flowIds.filter((id) => ids.includes(id)).map((id) => (
                      <GuideCard key={id} entity={entities.get(id)} record={review.verdicts[id]}
                        viewed={review.viewed.includes(id)} focused={focusId === id}
                        onFocus={() => setFocusId(id)} />
                    ))}
                  </div>
                </section>
              );
            });
          })()}

          {rejectedIds.length > 0 ? (
            <section>
              <h2 className="text-base font-semibold leading-snug">Considered but rejected</h2>
              <p className="mt-3 text-sm leading-relaxed">
                The system didn't reach highest confidence in these, so it rejected them —
                the reasoning is on each card. Selecting one shows the evidence; approving
                it overrules the system, on the record.
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                {rejectedIds.map((id) => (
                  <RejectedCard key={id} entity={entities.get(id)} record={review.verdicts[id]}
                    focused={focusId === id} onFocus={() => setFocusId(id)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-14 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          {focusedEntity ? (
            <>
              {rejectedIds.includes(focusId) ? (
                <p className="mb-2 text-xs text-warning">
                  The system rejected this: {confidenceOf(focusedEntity).reasons.join("; ")}.
                  {canAccept(focusedEntity) ? " Approving it overrules the system, on the record." : ""}
                </p>
              ) : null}
              <DetailPane entity={focusedEntity} record={review.verdicts[focusId]}
                onJudge={(verdict) => judge(focusId, verdict)}
                onReason={(kind) => setPending({id: focusId, kind})}
                onRepair={() => repair(focusId)}
                onUndo={() => dispatch({type: "undo"})}
                onAsk={(q) => openChat(focusId, q)} />
            </>
          ) : null}
        </div>
      </div>

      <ChatWindow
        title={chatEntity ? chatEntity.proposal.title : ""}
        chat={chats[chatFor] ?? []}
        suggestions={chatEntity ? questionsFor(chatEntity) : []}
        state={chatEntity ? chatState : "closed"}
        onAsk={(q) => ask(chatFor, q)}
        onMinimize={() => setChatState(chatState === "min" ? "open" : "min")}
        onClose={() => setChatState("closed")} />

      <ReasonModal pending={pending}
        onPick={(code) => judge(pending.id, pending.kind, code)} onClose={() => setPending(null)} />
    </div>
  );
}

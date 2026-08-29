# App Map prototype

The human surface of App Mapping — Given/When/Then queries over observed
shipped state — per
`docs/superpowers/specs/2026-08-23-app-map-human-surface-design.md`.

Standalone validation prototype. Local-only by repo convention
(`artifacts/` is gitignored); the committed record is the spec and plan.

## Run

    npm install
    npm run dev      # http://127.0.0.1:5173
    npm run check    # node --test (62 tests across 11 files) + vite build

## Fixtures, honestly

`src/fixtures.js` is SYNTHETIC data in the exact shape of the published-map
data contract (spec §6): frozen screen keys, top-first stacks, variant sets,
role-tagged edges with traversable flags, per-Given observations. Screenshots
are deterministic wireframe SVGs. Swapping in golden-corpus data (rulings Q10)
means replacing this one module; components read only its exported shape. The
derived-view modules (`reel-view.js`, `screen-sheet-view.js`, `diff-view.js`)
are tested as pure functions over that same fixture shape, independent of
rendering.

What this prototype therefore does NOT show: real screens, real lane counts,
real staleness. The states it renders (fresh/stale/thin/not-walked, the
substitution banner, the diff arithmetic) are the product behavior under test.

## Workspace (v2)

The prototype now runs as a workspace app: sidebar shell with live catalog
counts, four primitive catalogs (Screens, Journeys, Lanes, Builds) with
entity pages, and "Ask the Map" (⌘K) — an AI-search-shaped interface backed
by a deterministic resolver over the same fixtures. Every answer cites the
map and carries the provenance label "deterministic resolver over the
published map · model slot reserved"; misses are honest. No people, no
inbox, no fake workspace furniture — the sidebar footer identifies the
map itself (environment frame + version).

Spec: `docs/superpowers/specs/2026-08-23-app-map-workspace-design.md`.

## Design directions (v3)

The landing surface exists in three live directions, switchable with `1` `2` `3` or
`?dir=control|evidence|ledger`; the choice is not yet made.

- **Control Room** — the Given/When/Then grammar as an editable sentence, three signal
  cards (freshest / decayed furthest / thinnest evidence), then the coverage grid.
- **Evidence Wall** — every journey's freshest observed walk as a strip of captures.
- **Ledger** — build-by-build record of what appeared, vanished and changed.

All three read from `src/landing-view.js`, a pure module over the fixture shape, so they
cannot disagree about the numbers. Build-over-build movement is computed only across
Givens observed on *both* builds — a build whose Givens are all new reports nothing
rather than a fabricated change.

Shared foundation: token system with light and dark themes (`src/tokens.css`, OS-following
with a header override), a type scale, elevation, copy-confirming toasts, capture
wireframes that vary by kind and observed variant, keyboard chords (`g`+letter, `[`/`]`,
`c`, `?`), and a ⌘K palette that opens with what the map can answer.

## Thread map (v4)

`/threads` is the spatial view: a pannable, zoomable screen graph, one band per
journey, laid out by `src/thread-layout.js` (longest-path ranking over the DAG plus a
median crossing-reduction pass — deterministic, no layout library, no new deps).

It draws **two graphs at once**, which is the point:

- **declared** — `EDGES`, the transitions the app offers. Branchy; this is where the
  forks and merges live.
- **observed** — what a crawl actually took. A walk is a sequence, so on its own it is
  always a line.

They genuinely differ in the fixture: of 36 declared edges and 37 observed transitions,
27 appear in both, 9 are declared but never walked, and 10 were walked but are not
declared. Ranking uses the declared edges so branches survive; observed transitions are
drawn on top and never move anything.

Every node and edge carries one of four states against the mounted Given — `fresh`,
`stale`, `elsewhere` (exists, not observed here), `never` — so moving the Given visibly
relights the map. Switching market US → DE on Onboarding darkens Tipping intro and lights
the EU consent branch, which is the fork the linear reel cannot show.

## Reports (v4)

`/reports` is the fifth catalog. A report is one agentic validation run over
Given/When/Then requirements, executed per lane, with eight requirement states
(`pass fail flaky review blocked skip running queued`) and a merge gate derived from
them — an unfinished run outranks a failure, because a run that has not finished has not
earned a verdict. Failures auto-expand with expected/actual, the agent session, logs, and
the screens the requirement exercised, linked back into the map by frozen key.

Arithmetic lives in `src/report-view.js` (pure, tested); the fixtures cite real screen
keys, lanes and builds, so a report is part of the map rather than a document beside it.

## Review (v5) — the Countersign prototype

`/review` is the accept loop for agent-authored contract proposals, per the
2026-08-28 script-composer brainstorm (agents author, humans review, plugin
spawns a local page). Synthetic proposals in `src/proposal-fixtures.js` cite
real frozen screen keys, so every claim is re-derived from the map rather
than trusted: per-hop edge existence and observation counts (global and
under the proposal's own Given), overlap against countersigned requirements
(duplicate / variant), claimed-vs-confirmed, and a local risk rank
(novelty · money/consent rules · never-run · map weakness · overreach
markers in the agent's stated intent).

**Plain shape (v5.3 — "simplify, simplify, simplify").** One list, no ids,
no jargon. A row is a title plus its given / when / then as hoverable chips
(hover a route chip for every screen and how often the map has seen it under
this given); the only extra chips are the two human-attention signals,
"already covered?" and "goes beyond source". Verbs are plain: **Approve ·
Send back · Reject**. Everything deeper — the agent's reasoning, per-screen
verification, source, the derived question — lives in a right Sheet opened
with `↵`/`o` or Details. Proposals the map has already ruled out sink to a
grayed "Ruled out by the map" group at the bottom, out of the flow and the
count, each stating its reason in words ("uses a step the map has never
seen"); opening one can offer a fix ("Fix the route via EU data consent"),
which rejoins it to the list. Keyboard: `j/k` move, `a` approve and
auto-advance, `x`/`r` reject / send back via the plain-language reason
picker (`1–6`), `e` fix, `z` undo. The gate still fails closed and the Then
still carries no machine checkmark — the map verifies the When; the rules
are the reviewer's call. (The matrix/batch-accept UI from v5.1 was dropped
in this pass; the pure logic and tests remain in `review-view.js` while the
batch-posture question stays open.)

**Agent reasoning + follow-up chat (v5.4, HeroUI Pro AI components).** The
reasoning is a collapsed ChainOfThought — "How the agent got here" with
simple labeled steps (Source / Setup / Route / Checks / Reasoning) derived
from the proposal's source, auto-expanded only when a step is flagged for
overreach. Follow-up is an actual chat: derived questions as tappable
suggestions, real user/assistant exchanges (ChatMessage bubbles, a
collapsed "Worked it out" chain on the reply, a PromptInput composer).
Replies are pure functions over the same map derivations the page shows
(`chatReply` in `review-view.js`, tested) and carry the workspace's honesty
line — "from the map's records · deterministic" — with an honest miss for
anything the map can't answer, which routes the reviewer toward send-back.

**Two-pane IA (v5.5–v5.8, Linear-review-shaped).** Master–detail. The left
is a real Guide: numbered sections (one per agent session, `01 / 02`, a
green Reviewed check when done) that open with derived natural-language
narration — "factor-bot read the legacy test specs and a successful live
run and proposes 8 new rules, covering onboarding and order tracking.
Worth a closer look: 3 cover settings the map has never walked…"
(`guideProse` in `review-view.js`, pure and tested, so the prose cannot
oversell) — followed by a list of proposal cards. **There is no advisory
middle** (v5.9): the flow holds only proposals the system triages at
highest confidence — "Every rule here verifies cleanly against the map"
is an invariant, not a claim — and everything else lands in a
**"Considered but rejected"** section at the bottom, each card carrying
the system's reasoning in words ("repeats the approved rule …", "the map
has never walked this route with these settings", "asserts more than its
source checked"; `confidenceOf` in `review-view.js`, tested). Selecting a
rejected card shows its evidence, and approving it overrules the system —
on the record.
The focused proposal's evidence gets the whole right pane, always visible,
never behind a panel —
verdict actions at top, Given/When/Then with per-screen sightings, the
reasoning chain, and the suggested questions. `↑/↓` drives the index; the
right pane follows. Three tabs, named as Linear names them: **Overview**
(what the agents propose — description only, sources named, no review
state), **Guide** (the two panes), **Diff** (the artifact itself: each
proposal rendered as the yaml file diff approving applies — line numbers,
+/− gutters, all-additions for new rules, all-deletions for removals,
-/+ route lines for edits; `yamlDiff`/`yamlFileFor` in `review-view.js`,
tested). A Linear-style table of contents hides behind tick marks at the
Guide's own left edge — inside the page, not the app nav — and appears on
hover: sessions, titles, states, click to jump.
**Approval is green** (the success token, the one semantic color a verdict
button carries) at both levels: per-proposal Approve, and a review-level
"Approve review" in the tab bar that unlocks when everything is judged.
The chat is a floating bottom-right window bound to the proposal it was
opened for (`↵` opens it): it survives focus moves, `esc` minimizes it to
a docked title chip, and the thread persists across minimize/restore. Chat
and judgment state are in-memory, like everything here.

Arithmetic lives in `src/review-view.js` (pure, tested). Judgments are
in-memory only — this prototype answers "does the accept loop feel right in
this design language?", not persistence; a reload clears every verdict.
**Verdict so far:** the single-page shape beats the docket-plus-pages
architecture it replaced — judging where you read removes the navigation
tax, and compressed judged sections make progress feel physical; the open
call is still batch-accept posture per risk class.

## Deliberately absent (spec §8)

Composed/NL queries · promotion review beyond the Countersign docket ·
Pulse pins (slot reserved in the screen sheet) · free-form authoring (the
composer exists only as repair-in-review) · persistence of verdicts ·
anything public.

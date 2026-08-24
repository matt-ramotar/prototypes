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

## Deliberately absent (spec §8)

Composed/NL queries · promotion review · Pulse pins
(slot reserved in the screen sheet) · authoring · anything public.

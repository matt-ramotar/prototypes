import {useEffect, useReducer, useState} from "react";
import {RouterProvider} from "react-aria-components";
import {useUrlState} from "./use-url-state.js";
import {resolveAnswer, canonicalize} from "./query.js";
import {counterpartQuery} from "./diff-view.js";
import {AppShell} from "./shell.jsx";
import {AtlasSurface} from "./atlas.jsx";
import {ReelSurface} from "./reel.jsx";
import {DiffSurface} from "./diff-report.jsx";
import {ScreenSheet} from "./screen-sheet.jsx";
import {ScreensCatalog} from "./screens-catalog.jsx";
import {JourneysCatalog} from "./journeys-catalog.jsx";
import {LanesCatalog} from "./lanes-catalog.jsx";
import {BuildsCatalog} from "./builds-catalog.jsx";
import {ScreenPage} from "./screen-page.jsx";
import {JourneyPage} from "./journey-page.jsx";
import {LanePage} from "./lane-page.jsx";
import {BuildPage} from "./build-page.jsx";
import {AskOverlay} from "./ask-overlay.jsx";
import {AskPage} from "./ask-page.jsx";
import {ReportsCatalog} from "./reports-catalog.jsx";
import {ReportPage} from "./report-page.jsx";
import {ReviewSurface} from "./review-surface.jsx";
import {initialReview, reviewReduce} from "./review-view.js";
import {MapHome} from "./map-home.jsx";
import {ShortcutsModal, useShortcuts} from "./shortcuts.jsx";
import {copyWithToast} from "./toast.jsx";
import {JOURNEYS, LANES, REPORTS, SCREENS} from "./fixtures.js";

function laneLabel(query) {
  const lane = LANES.find((l) =>
    l.container.toLowerCase() === (query.container ?? "").toLowerCase() &&
    l.platform.toLowerCase() === (query.platform ?? "").toLowerCase());
  return lane ? `${lane.container} · ${lane.platform}` : null;
}

export default function App() {
  const {route, query, notes, navigate} = useUrlState();
  const onPivot = (field, counterpart) => navigate({patch: {...query, pivot: field, counterpart, view: "report"}});
  const onOpenScreen = (key) => navigate({patch: {...query, screen: key}});
  const [askOpen, setAskOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Review judgments live in memory only — this prototype checks the accept
  // loop's feel, not its persistence. A reload clears every verdict.
  const [review, dispatchReview] = useReducer(reviewReduce, initialReview);

  useShortcuts({
    navigate, query,
    onAsk: () => setAskOpen((v) => !v),
    onHelp: () => setHelpOpen(true),
    onCopyLink: () => copyWithToast(window.location.href, "Permalink copied"),
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setAskOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onLandingNavigate = ({go, ...patch}) => {
    if (go) navigate({path: "/map", patch: {...query, ...patch}});
    else navigate({patch: {...query, ...patch}});
  };

  let body = null;
  let crumbs = [{label: "Territory"}];

  if (route.page === "atlas" || route.page === "threads") {
    crumbs = [{label: "Territory"}];
    body = (
      <MapHome query={query} notes={notes} navigate={navigate}
        onNavigate={onLandingNavigate} onAsk={() => setAskOpen(true)} onPivot={onPivot} />
    );
  } else if (route.page === "map") {
    const resolution = resolveAnswer(query, new Date());
    const journeyLabel = JOURNEYS.find((j) => j.id === query.journey)?.label ?? "Route";
    const lane = laneLabel(query);
    if (resolution.kind === "atlas") {
      crumbs = [{label: "Territory", page: "atlas"}, {label: "Coverage"}];
      body = <AtlasSurface query={query} notes={notes} onNavigate={(patch) => navigate({patch: {...query, ...patch}})} onPivot={onPivot} />;
    } else if (query.pivot != null) {
      crumbs = [{label: "Territory", page: "atlas"}, {label: journeyLabel},
        ...(lane ? [{label: lane}] : []), {label: "Diff"}];
      body = (
        <>
          <DiffSurface query={query} notes={notes} onNavigate={(patch) => navigate({patch: {...query, ...patch}})}
            onPivot={onPivot} onOpenScreen={onOpenScreen} />
          {query.screen && sheetFor(query, resolution, onSheetClose)}
        </>
      );
    } else {
      crumbs = [{label: "Territory", page: "atlas"}, {label: journeyLabel},
        ...(lane ? [{label: lane}] : [])];
      body = (
        <>
          <ReelSurface resolution={resolution} query={query} notes={notes}
            onNavigate={(patch) => navigate({patch: {...query, ...patch}})}
            onPivot={onPivot} onOpenScreen={onOpenScreen} />
          {query.screen && resolution.kind === "answer" && (
            <ScreenSheet screenKey={query.screen} answer={resolution.answer} onClose={onSheetClose} navigate={navigate} />
          )}
        </>
      );
    }
  } else if (route.page === "ask") { crumbs = [{label: "Ask the Map"}]; body = <AskPage navigate={navigate} />; }
  else if (route.page === "screens") { crumbs = [{label: "Screens"}]; body = <ScreensCatalog navigate={navigate} />; }
  else if (route.page === "screen") {
    const s = SCREENS[route.params.key];
    crumbs = [{label: "Screens", page: "screens"}, {label: s ? (s.label ?? s.derivedLabel) : route.params.key}];
    body = <ScreenPage screenKey={route.params.key} navigate={navigate} />;
  } else if (route.page === "journeys") { crumbs = [{label: "Journeys"}]; body = <JourneysCatalog navigate={navigate} />; }
  else if (route.page === "journey") {
    const j = JOURNEYS.find((x) => x.id === route.params.id);
    crumbs = [{label: "Journeys", page: "journeys"}, {label: j?.label ?? route.params.id}];
    body = <JourneyPage id={route.params.id} navigate={navigate} />;
  } else if (route.page === "lanes") { crumbs = [{label: "Lanes"}]; body = <LanesCatalog navigate={navigate} />; }
  else if (route.page === "lane") {
    const l = LANES.find((x) => x.id === route.params.id);
    crumbs = [{label: "Lanes", page: "lanes"}, {label: l ? `${l.container} · ${l.platform}` : route.params.id}];
    body = <LanePage id={route.params.id} navigate={navigate} />;
  } else if (route.page === "reports") { crumbs = [{label: "Reports"}]; body = <ReportsCatalog navigate={navigate} />; }
  else if (route.page === "report") {
    const r = REPORTS.find((x) => x.id === route.params.id);
    crumbs = [{label: "Reports", page: "reports"}, {label: r ? `#${r.id}` : route.params.id}];
    body = <ReportPage id={route.params.id} navigate={navigate} />;
  } else if (route.page === "review") {
    crumbs = [{label: "Review"}];
    body = <ReviewSurface review={review} dispatch={dispatchReview} />;
  } else if (route.page === "proposal") {
    crumbs = [{label: "Review", page: "review"}, {label: route.params.id}];
    body = <ReviewSurface review={review} dispatch={dispatchReview} focusParam={route.params.id} />;
  } else if (route.page === "builds") { crumbs = [{label: "Builds"}]; body = <BuildsCatalog navigate={navigate} />; }
  else if (route.page === "build") {
    crumbs = [{label: "Builds", page: "builds"}, {label: `b${route.params.id}`}];
    body = <BuildPage id={route.params.id} navigate={navigate} />;
  }

  function onSheetClose() { navigate({patch: {...query, screen: null}}); }
  function sheetFor(q, resolution, onClose) {
    if (q.view === "reel-b") {
      const rB = resolveAnswer(canonicalize(counterpartQuery(q)).query, new Date());
      if (rB.kind === "answer")
        return <ScreenSheet screenKey={q.screen} answer={rB.answer} onClose={onClose} navigate={navigate} />;
    }
    if (resolution.kind === "answer")
      return <ScreenSheet screenKey={q.screen} answer={resolution.answer} onClose={onClose} navigate={navigate} />;
    return null;
  }

  const mapHome = route.page === "atlas" || route.page === "threads";
  const go = (href) => {
    const url = new URL(href, window.location.origin);
    navigate({path: url.pathname, patch: Object.fromEntries(url.searchParams)});
  };

  return (
    <RouterProvider navigate={go}>
      <AppShell route={route} onAsk={() => setAskOpen(true)} crumbs={crumbs}
        onShortcuts={() => setHelpOpen(true)} fill={mapHome}>
        {body}
        <AskOverlay open={askOpen} onClose={() => setAskOpen(false)} navigate={navigate} />
        <ShortcutsModal isOpen={helpOpen} onOpenChange={setHelpOpen} />
      </AppShell>
    </RouterProvider>
  );
}

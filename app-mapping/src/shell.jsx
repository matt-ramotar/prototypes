import {useEffect, useState} from "react";
import {Breadcrumbs, Button, Chip, Kbd, SearchField, Tooltip} from "@heroui/react";
import {Sidebar} from "@heroui-pro/react/sidebar";
import {FRAME_LINE, MAP_VERSION} from "./fixtures.js";
import {catalogCounts} from "./catalog-view.js";
import {pathFor} from "./routes.js";
import {GIcon} from "./ui.jsx";
import {copyWithToast} from "./toast.jsx";
import {apply, nextMode, resolve, setMode, storedMode} from "./theme.js";

const NAV = [
  {label: "Map", items: [
    {page: "atlas", label: "Territory", icon: "map-pin"},
  ]},
  {label: "Catalogs", items: [
    {page: "screens", label: "Screens", icon: "square-list-ul", countKey: "screens"},
    {page: "journeys", label: "Journeys", icon: "route", countKey: "journeys"},
    {page: "lanes", label: "Lanes", icon: "layers-3-diagonal", countKey: "lanes"},
    {page: "builds", label: "Builds", icon: "cube", countKey: "builds"},
  ]},
  {label: "Validation", items: [
    {page: "reports", label: "Reports", icon: "list-check", countKey: "reports"},
    {page: "review", label: "Review", icon: "circle-check", countKey: "review"},
  ]},
];

const THEME_ICON = {system: "display", light: "sun", dark: "moon"};

function BrandHeader() {
  return (
    <div className="flex items-center gap-2.5 px-1 py-1.5">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent text-accent-foreground">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 9.5V2.5h3.2c1.5 0 2.4.8 2.4 2 0 .9-.5 1.6-1.4 1.9L8.8 9.5H7.2L5.3 6.5H3.4V9.5H2Zm1.4-4.2h1.6c.8 0 1.2-.4 1.2-1s-.4-1-1.2-1H3.4v2Z" fill="currentColor" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold text-foreground">App Map</p>
        <p className="truncate text-xs text-muted">Northstar · Consumer</p>
      </div>
    </div>
  );
}

function SidebarNav({activePage, counts, onAsk}) {
  return (
    <>
      <Sidebar.Group>
        <Sidebar.Menu aria-label="Ask">
          <Sidebar.MenuItem id="ask" textValue="Ask the Map" onAction={onAsk}>
            <Sidebar.MenuIcon>
              <GIcon name="magnifier" size={16} />
            </Sidebar.MenuIcon>
            <Sidebar.MenuLabel>Ask the Map</Sidebar.MenuLabel>
            <Sidebar.MenuChip>
              <Kbd variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>K</Kbd.Content>
              </Kbd>
            </Sidebar.MenuChip>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Group>
      {NAV.map((section) => (
        <Sidebar.Group key={section.label}>
          <Sidebar.GroupLabel>{section.label}</Sidebar.GroupLabel>
          <Sidebar.Menu aria-label={section.label}>
            {section.items.map((item) => (
              <Sidebar.MenuItem
                key={item.page}
                id={item.page}
                href={pathFor(item.page)}
                isCurrent={activePage === item.page}
                textValue={item.label}>
                <Sidebar.MenuIcon>
                  <GIcon name={item.icon} size={16} />
                </Sidebar.MenuIcon>
                <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
                {item.countKey ? (
                  <Sidebar.MenuChip>{counts[item.countKey]}</Sidebar.MenuChip>
                ) : null}
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      ))}
    </>
  );
}

function SidebarFoot() {
  return (
    <div className="px-1 pt-2 pb-1">
      <p className="text-xs leading-relaxed text-muted">{FRAME_LINE}</p>
      <Chip size="sm" variant="soft" className="mt-2">
        <span className="inline-block size-1.5 rounded-full bg-success" />
        map v{MAP_VERSION}
      </Chip>
    </div>
  );
}

function ThemeToggle() {
  const [mode, setLocal] = useState(storedMode);

  useEffect(() => {
    if (mode !== "system" || typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const cycle = () => { const next = nextMode(mode); setMode(next); setLocal(next); };
  const label = mode === "system" ? `Theme: system (${resolve(mode)})` : `Theme: ${mode}`;
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button isIconOnly size="sm" variant="ghost" aria-label={label} onPress={cycle}>
          <GIcon name={THEME_ICON[mode]} size={16} className="text-muted" />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

function Topbar({crumbs, onShortcuts, onAsk}) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 md:px-8">
      <Sidebar.Trigger className="md:hidden" />
      {crumbs.length > 0 ? (
        <Breadcrumbs className="min-w-0 no-underline">
          {crumbs.map((c, i) => (
            <Breadcrumbs.Item
              key={`${c.label}-${i}`}
              className={i === crumbs.length - 1 ? "font-medium no-underline" : "text-muted no-underline"}
              href={c.page ? pathFor(c.page, c.param) : undefined}>
              {c.label}
            </Breadcrumbs.Item>
          ))}
        </Breadcrumbs>
      ) : (
        <span className="text-sm font-medium text-foreground">Territory</span>
      )}
      <div className="ml-auto flex items-center gap-3">
        {onAsk ? (
          <div className="hidden lg:block" onPointerDown={(e) => { e.preventDefault(); onAsk(); }}>
            <SearchField aria-label="Ask the Map">
              <SearchField.Group className="w-64">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Ask the Map" readOnly />
                <Kbd className="mr-2 shrink-0" variant="light">
                  <Kbd.Abbr keyValue="command" />
                  <Kbd.Content>K</Kbd.Content>
                </Kbd>
              </SearchField.Group>
            </SearchField>
          </div>
        ) : null}
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Copy permalink"
              onPress={() => copyWithToast(window.location.href, "Permalink copied")}>
              <GIcon name="link" size={16} className="text-muted" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Copy permalink</Tooltip.Content>
        </Tooltip>
        {onShortcuts ? (
          <Tooltip>
            <Tooltip.Trigger>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Keyboard shortcuts"
                onPress={onShortcuts}>
                <GIcon name="keyboard" size={16} className="text-muted" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Keyboard shortcuts</Tooltip.Content>
          </Tooltip>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppShell({route, onAsk, crumbs = [], onShortcuts, fill, children}) {
  const counts = catalogCounts();
  const activePage = (route.page === "map" || route.page === "ask")
    ? null
    : {
      screen: "screens",
      journey: "journeys",
      lane: "lanes",
      build: "builds",
      report: "reports",
      proposal: "review",
      threads: "atlas",
    }[route.page] ?? route.page;

  return (
    <Sidebar.Provider>
      <Sidebar>
        <Sidebar.Header>
          <BrandHeader />
        </Sidebar.Header>
        <Sidebar.Content>
          <SidebarNav activePage={activePage} counts={counts} onAsk={onAsk} />
        </Sidebar.Content>
        <Sidebar.Footer>
          <SidebarFoot />
        </Sidebar.Footer>
        <Sidebar.Rail />
      </Sidebar>
      <Sidebar.Mobile>
        <Sidebar.Header>
          <BrandHeader />
        </Sidebar.Header>
        <Sidebar.Content>
          <SidebarNav activePage={activePage} counts={counts} onAsk={onAsk} />
        </Sidebar.Content>
        <Sidebar.Footer>
          <SidebarFoot />
        </Sidebar.Footer>
      </Sidebar.Mobile>
      <Sidebar.Main className={`bg-background min-w-0 ${fill ? "flex min-h-dvh flex-col" : ""}`}>
        <Topbar crumbs={crumbs} onShortcuts={onShortcuts} onAsk={onAsk} />
        {fill ? <div className="relative min-h-0 flex-1">{children}</div> : children}
      </Sidebar.Main>
    </Sidebar.Provider>
  );
}

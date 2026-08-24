import {Chip, ListBox, SearchField, Select, Table} from "@heroui/react";
import {useMemo, useState} from "react";
import {filterScreenRows, screenFilterOptions, screenRows} from "./catalog-view.js";
import {WireScreenshot} from "./screenshot.jsx";
import {Link} from "./link.jsx";
import {CopyKey, EmptyPanel, NamedScreen, PAGE, PageHeader, StatCards, VARIANT_COLOR, freshness} from "./ui.jsx";
import {MAP_VERSION} from "./fixtures.js";

function useCatalogFilters() {
  const p = new URLSearchParams(window.location.search);
  const initial = {q: p.get("q") ?? "", kind: p.get("kind") ?? "", journey: p.get("cjourney") ?? "",
    phase: p.get("cphase") ?? "", lane: p.get("clane") ?? "", variant: p.get("cvariant") ?? "",
    naming: p.get("naming") ?? ""};
  const [filters, setFilters] = useState(initial);
  const update = (patch) => {
    const next = {...filters, ...patch};
    setFilters(next);
    const sp = new URLSearchParams();
    const map = {q: "q", kind: "kind", journey: "cjourney", phase: "cphase", lane: "clane",
      variant: "cvariant", naming: "naming"};
    for (const [k, param] of Object.entries(map)) if (next[k]) sp.set(param, next[k]);
    const qs = sp.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  };
  return [filters, update];
}

function FilterSelect({label, value, options, onChange}) {
  return (
    <Select selectedKey={value || null} onSelectionChange={(k) => onChange(k == null || k === "__all__" ? "" : String(k))}
      placeholder={label} aria-label={label} size="sm" className="min-w-[130px]">
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="__all__">{`All ${label.toLowerCase()}`}</ListBox.Item>
          {options.map((o) => <ListBox.Item key={o.id ?? o} id={o.id ?? o}>{o.label ?? o}</ListBox.Item>)}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function ScreensCatalog() {
  const now = useMemo(() => new Date(), []);
  const all = useMemo(() => screenRows(now), [now]);
  const options = useMemo(() => screenFilterOptions(), []);
  const [filters, update] = useCatalogFilters();
  const rows = filterScreenRows(all, {
    q: filters.q || null, kind: filters.kind || null, journey: filters.journey || null,
    phase: filters.phase || null, lane: filters.lane || null, variant: filters.variant || null,
    naming: filters.naming || null,
  });
  const named = all.filter((r) => r.screen.label).length;
  const derived = all.length - named;
  const allScreens = all.filter((r) => r.screen.kind === "SCREEN").length;
  const allOverlays = all.length - allScreens;

  return (
    <div className={PAGE}>
      <PageHeader
        chip="Registry"
        id={`v${MAP_VERSION}`}
        title="Screens"
        description="Every named and derived screen the crawler has observed. Filters narrow the table; they never invent a screen the map does not already hold."
      />
      <StatCards items={[
        {label: "Screens", value: allScreens, note: "in the registry", tone: "text-muted"},
        {label: "Overlays", value: allOverlays, note: "modals and sheets", tone: "text-muted"},
        {label: "Named", value: named, note: "through the registry", tone: "text-success"},
        {label: "Derived", value: derived, note: "provisional labels", tone: "text-warning"},
      ]} />
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <SearchField value={filters.q} onChange={(v) => update({q: v})} aria-label="Search screens"
          className="min-w-[220px]">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search name or key…" />
          </SearchField.Group>
        </SearchField>
        <FilterSelect label="Kind" value={filters.kind}
          options={[{id: "SCREEN", label: "Screens"}, {id: "OVERLAY", label: "Overlays"}]}
          onChange={(v) => update({kind: v})} />
        <FilterSelect label="Journey" value={filters.journey} options={options.journeys}
          onChange={(v) => update({journey: v})} />
        <FilterSelect label="Phase" value={filters.phase} options={options.phases}
          onChange={(v) => update({phase: v})} />
        <FilterSelect label="Lane" value={filters.lane} options={options.lanes}
          onChange={(v) => update({lane: v})} />
        <FilterSelect label="Variant" value={filters.variant} options={options.variants}
          onChange={(v) => update({variant: v})} />
        <FilterSelect label="Naming" value={filters.naming}
          options={[{id: "named", label: "Named"}, {id: "derived", label: "Derived"}]}
          onChange={(v) => update({naming: v})} />
      </div>
      {rows.length === 0 ? (
        <div className="mt-10">
          <EmptyPanel
            icon="magnifier"
            title="No screens match these filters"
            description={`The catalog holds ${all.length} entries; every active filter narrows it. Clear one to widen the set.`}
          />
        </div>
      ) : (
        <Table className="mt-6">
          <Table.ScrollContainer>
            <Table.Content aria-label="Screens">
              <Table.Header>
                <Table.Column className="w-12" />
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Kind</Table.Column>
                <Table.Column>Journey · Phase</Table.Column>
                <Table.Column>Variants</Table.Column>
                <Table.Column>Lanes</Table.Column>
                <Table.Column>Freshness</Table.Column>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => (
                  <Table.Row key={r.screen.key} id={r.screen.key}>
                    <Table.Cell>
                      <WireScreenshot screenKey={r.screen.key} width={30} height={56} />
                    </Table.Cell>
                    <Table.Cell>
                      <Link to="screen" param={r.screen.key}>
                        <NamedScreen screen={r.screen} />
                      </Link>
                      <div><CopyKey value={r.screen.key} /></div>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" color={r.screen.kind === "OVERLAY" ? "warning" : "accent"} variant="soft">
                        {r.screen.kind.toLowerCase()}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-muted">{r.journey.label} · {r.screen.phase}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-wrap gap-1">
                        {r.variantSet.map((v) => (
                          <Chip key={v} size="sm" color={VARIANT_COLOR[v] ?? "default"}
                            variant={VARIANT_COLOR[v] ? "soft" : "secondary"}>
                            {v}
                          </Chip>
                        ))}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="font-mono tabular-nums">{r.laneIds.length}</Table.Cell>
                    <Table.Cell className="font-mono tabular-nums text-muted">
                      {freshness(r.latestBuild, r.ageDays)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}

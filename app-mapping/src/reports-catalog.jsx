import {useMemo} from "react";
import {Chip, Table} from "@heroui/react";
import {GATE_COPY, STATUS_LABEL, reportRows} from "./report-view.js";
import {StatusBar, StatusIcon} from "./report-status.jsx";
import {SEVERITY} from "./report-view.js";
import {Link} from "./link.jsx";
import {LANES, MAP_VERSION} from "./fixtures.js";
import {PAGE, PageHeader, StatCards} from "./ui.jsx";

const WHEN = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short"});

export function ReportsCatalog() {
  const now = useMemo(() => new Date(), []);
  const rows = useMemo(() => reportRows(now), [now]);
  const blocked = rows.filter((r) => r.gate === "blocked").length;
  const running = rows.filter((r) => r.gate === "running").length;
  const ready = rows.filter((r) => r.gate === "ready").length;

  return (
    <div className={PAGE}>
      <PageHeader
        chip="Validation"
        id={`v${MAP_VERSION}`}
        title="Reports"
        description="Each run validates Given/When/Then requirements against the lanes the map already knows. A blocked run never implies a walk the crawler did not take."
      />
      <StatCards items={[
        {label: "Runs", value: rows.length, note: "in this ledger", tone: "text-muted"},
        {label: "Blocked", value: blocked, note: "blocking a merge", tone: "text-danger"},
        {label: "Running", value: running, note: "still in flight", tone: "text-accent"},
        {label: "Ready", value: ready, note: "cleared the gate", tone: "text-success"},
      ]} />
      <Table className="mt-8">
        <Table.ScrollContainer>
          <Table.Content aria-label="Reports">
            <Table.Header>
              <Table.Column className="w-10" />
              <Table.Column isRowHeader>Run</Table.Column>
              <Table.Column>Branch</Table.Column>
              <Table.Column>Lanes</Table.Column>
              <Table.Column>Outcome</Table.Column>
              <Table.Column>Requirements</Table.Column>
              <Table.Column>Finished</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => {
                const gate = GATE_COPY[row.gate];
                const segments = SEVERITY.filter((s) => row.counts[s] > 0)
                  .map((s) => ({status: s, count: row.counts[s]}));
                return (
                  <Table.Row key={row.report.id} id={row.report.id}>
                    <Table.Cell>
                      <StatusIcon status={row.gate === "blocked" ? "fail"
                        : row.gate === "ready" ? "pass" : "running"} />
                    </Table.Cell>
                    <Table.Cell>
                      <Link to="report" param={row.report.id}>{row.report.title}</Link>
                      <div className="font-mono text-xs text-muted">
                        #{row.report.id} · {row.report.commit}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="secondary" className="font-mono">
                        {row.report.branch}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-sm text-muted">
                      {row.lanes.length === 0 ? "—" : row.lanes
                        .map((id) => LANES.find((l) => l.id === id))
                        .filter(Boolean)
                        .map((l) => `${l.container} · ${l.platform}`)
                        .join(", ")}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col gap-1.5">
                        <Chip size="sm" color={gate.tone} variant="soft">{gate.chip}</Chip>
                        <StatusBar segments={segments} total={row.total} />
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm text-muted">
                      {SEVERITY.filter((s) => row.counts[s] > 0)
                        .map((s) => `${row.counts[s]} ${STATUS_LABEL[s]}`).join(" · ")}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm">
                      {row.report.finishedAt
                        ? `${WHEN.format(new Date(row.report.finishedAt))} · ${row.ageDays}d`
                        : <span className="text-muted">running</span>}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}

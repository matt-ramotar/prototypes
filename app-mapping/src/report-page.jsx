import {useMemo, useState} from "react";
import {Accordion, Alert, Button, Card, Disclosure, SearchField} from "@heroui/react";
import {SCREENS} from "./fixtures.js";
import {GATE_COPY, STATUS_LABEL, filterReport, reportEntity} from "./report-view.js";
import {StatusBar, StatusChip, StatusIcon} from "./report-status.jsx";
import {WireScreenshot} from "./screenshot.jsx";
import {Link} from "./link.jsx";
import {copyWithToast} from "./toast.jsx";
import {EmptyPanel, GIcon, NamedScreen, PAGE, PageHeader} from "./ui.jsx";

const WHEN = new Intl.DateTimeFormat("en-GB",
  {day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"});

const KPI_ORDER = ["pass", "fail", "flaky", "review", "blocked", "skip", "running", "queued"];
const GATE_STATUS = {blocked: "danger", ready: "success", running: "accent", empty: "warning"};

function Sentence({requirement}) {
  return (
    <p className="min-w-0 flex-1 text-sm">
      <b>Given</b> {requirement.given}, <b>When</b> {requirement.when},{" "}
      <b>Then</b> {requirement.then}.
    </p>
  );
}

function Diff({expected, actual}) {
  return (
    <div className="grid gap-1.5 text-sm">
      <span className="text-xs text-muted">Expected</span>
      <code className="rounded-lg bg-success/10 px-2 py-1.5 font-mono text-xs text-success">{expected}</code>
      <span className="text-xs text-muted">Actual</span>
      <code className="rounded-lg bg-danger/10 px-2 py-1.5 font-mono text-xs text-danger">{actual}</code>
    </div>
  );
}

function AgentSession({steps}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted">Agent session</h4>
      <ol className="mt-1.5 flex flex-col gap-1.5">
        {steps.map(([text, outcome], i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <StatusIcon status={outcome === "fail" ? "fail" : "pass"} size={13} />
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function LogBlock({title, lines}) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-xs font-medium text-muted">
        {title}
        <Button size="sm" variant="ghost"
          onPress={() => copyWithToast(lines.join("\n"), "Log copied")}>
          <GIcon name="copy" size={12} /> Copy
        </Button>
      </h4>
      <pre className="mt-1.5 overflow-x-auto rounded-xl bg-surface-secondary p-3 font-mono text-[11px] leading-relaxed text-muted">
        {lines.map((l, i) => <span key={i} className="block">{l}</span>)}
      </pre>
    </div>
  );
}

function TouchedScreens({keys}) {
  const known = keys.filter((k) => SCREENS[k]);
  if (known.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-medium text-muted">Screens exercised</h4>
      <div className="mt-1.5 flex flex-wrap gap-3">
        {known.map((k) => (
          <Link key={k} to="screen" param={k} className="flex flex-col items-center gap-1 text-xs text-foreground no-underline">
            <WireScreenshot screenKey={k} width={44} height={80} kind={SCREENS[k].kind} />
            <NamedScreen screen={SCREENS[k]} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Requirement({requirement}) {
  const r = requirement;
  const hasDetail = r.message || r.expected || r.steps || r.log || r.shot || r.note ||
    r.screens?.length > 0 || r.artifacts?.length > 0;
  const head = (
    <div className="flex w-full min-w-0 items-center gap-3">
      <StatusIcon status={r.status} />
      <Sentence requirement={r} />
      <span className="font-mono text-xs text-muted">{r.id}</span>
      <span className="font-mono text-xs text-muted">{r.dur}</span>
    </div>
  );
  if (!hasDetail) {
    return <div className="px-4 py-3">{head}</div>;
  }
  return (
    <Accordion.Item id={r.id}>
      <Accordion.Heading>
        <Accordion.Trigger className="w-full px-4 py-3 text-left">
          {head}
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex flex-wrap gap-3 font-mono text-xs text-muted">
            <span>{r.id}</span>
            <span>{STATUS_LABEL[r.status]} · {r.dur}</span>
          </div>
          {r.message ? <p className="text-sm">{r.message}</p> : null}
          {r.expected && r.actual ? <Diff expected={r.expected} actual={r.actual} /> : null}
          {r.steps ? <AgentSession steps={r.steps} /> : null}
          {r.log ? <LogBlock title={r.logTitle ?? "Log"} lines={r.log} /> : null}
          {r.shot ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <GIcon name="picture" size={18} />
              {r.shot}
            </p>
          ) : null}
          {r.note ? <p className="text-sm text-muted">{r.note}</p> : null}
          <TouchedScreens keys={r.screens ?? []} />
          {r.artifacts?.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Artifacts</span>
              {r.artifacts.map((a) => (
                <span key={a.label} className="inline-flex items-center gap-1 text-xs text-muted">
                  <GIcon name={a.icon} size={13} />{a.label}
                </span>
              ))}
            </div>
          ) : null}
        </Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function Job({job, openIds, onExpandedChange, collapsed, onCollapse}) {
  return (
    <Disclosure isExpanded={!collapsed} onExpandedChange={(open) => {
      if (open === collapsed) onCollapse();
    }}>
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-full items-center gap-3 px-1 py-2 text-left">
          <span className="grid size-8 place-items-center rounded-lg bg-surface-secondary">
            <GIcon name={job.lane ? "list-check" : "curly-brackets"} size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{job.name}</span>
            <span className="text-xs text-muted">{job.env}</span>
          </span>
          <StatusChip status={job.status} />
          <StatusBar segments={job.segments} total={job.total} />
          <span className="font-mono text-xs text-muted">{job.duration}</span>
          <Disclosure.Indicator />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <Card className="mt-2 gap-0 p-0">
            <Accordion allowsMultipleExpanded expandedKeys={openIds} onExpandedChange={onExpandedChange}>
              {job.requirements.map((r) => (
                <Requirement key={r.id} requirement={r} />
              ))}
            </Accordion>
          </Card>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

export function ReportPage({id, navigate}) {
  const now = useMemo(() => new Date(), []);
  const entity = useMemo(() => reportEntity(id, now), [id, now]);
  const [status, setStatus] = useState(null);
  const [q, setQ] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [closedJobs, setClosedJobs] = useState(() => new Set());
  const [primed, setPrimed] = useState(false);

  if (!entity) {
    return (
      <div className={PAGE}>
        <EmptyPanel icon="magnifier" title="No such report"
          description={`The map holds no validation report with id "${id}".`}
          action={<Button size="sm" variant="secondary"
            onPress={() => navigate({path: "/reports", patch: {}})}>All reports</Button>} />
      </div>
    );
  }

  if (!primed) {
    const failing = entity.requirements.filter((r) => r.status === "fail").map((r) => r.id);
    if (failing.length > 0) setOpenIds(new Set(failing));
    setPrimed(true);
  }

  const view = filterReport(entity, {status, q});
  const {report} = entity;
  const gate = GATE_COPY[entity.gate];
  const collapseJob = (jid) => setClosedJobs((prev) => {
    const next = new Set(prev);
    next.has(jid) ? next.delete(jid) : next.add(jid);
    return next;
  });
  const clear = () => { setStatus(null); setQ(""); };
  const allIds = view.classes.flatMap((c) => c.jobs.flatMap((j) => j.requirements.map((r) => r.id)));

  return (
    <div className={PAGE}>
      <PageHeader
        chip={gate.chip}
        chipColor={GATE_STATUS[entity.gate] ?? "warning"}
        id={`#${report.id}`}
        title={report.title}
        description={`${report.repo} · ${report.branch} into ${report.baseBranch} · ${report.commit}. Triggered by ${report.trigger} · ${WHEN.format(new Date(report.startedAt))} · ${report.finishedAt ? `finished in ${report.duration}` : report.duration}.`}
        actions={
          <>
            <Button size="sm" variant="secondary"
              onPress={() => copyWithToast(window.location.href, "Permalink copied")}>
              <GIcon name="copy" size={14} />Copy link
            </Button>
            <Button size="sm" variant="primary"
              onPress={() => navigate({path: `/builds/${report.build}`, patch: {}})}>
              b{report.build}
              <GIcon name="arrow-right" size={14} />
            </Button>
          </>
        }
      />

      <Alert status={GATE_STATUS[entity.gate] ?? "warning"} className="mt-6">
        <Alert.Indicator>
          <StatusIcon status={entity.gate === "blocked" ? "fail"
            : entity.gate === "ready" ? "pass" : "running"} size={19} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>{gate.label}</Alert.Title>
          <Alert.Description>{gate.line(entity.counts)}</Alert.Description>
        </Alert.Content>
        {entity.counts.fail > 0 ? (
          <Button size="sm" variant="danger-soft" onPress={() => setStatus("fail")}>
            Review {entity.counts.fail} {entity.counts.fail === 1 ? "failure" : "failures"}
          </Button>
        ) : null}
      </Alert>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_ORDER.filter((s) => entity.counts[s] > 0).map((s) => (
          <button key={s} type="button" onClick={() => setStatus((prev) => (prev === s ? null : s))}>
            <Card className={`h-full gap-2 p-4 ${status === s ? "ring-1 ring-accent" : ""}`}>
              <Card.Header className="p-0">
                <Card.Title className="flex items-center gap-1.5 text-sm font-normal text-muted">
                  <StatusIcon status={s} size={14} />
                  {STATUS_LABEL[s]}
                </Card.Title>
              </Card.Header>
              <Card.Content className="p-0">
                <span className="font-mono text-3xl font-semibold tabular-nums">{entity.counts[s]}</span>
              </Card.Content>
            </Card>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} aria-label="Search requirements" className="min-w-[260px]">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search requirements…" />
          </SearchField.Group>
        </SearchField>
        {view.isFiltered ? (
          <span className="text-sm text-muted">
            {view.shown} of {entity.total} shown
            <Button size="sm" variant="ghost" className="ml-1" onPress={clear}>Clear</Button>
          </span>
        ) : null}
        <span className="ml-auto flex gap-1.5">
          <Button size="sm" variant="ghost" onPress={() => setOpenIds(new Set(allIds))}>
            Expand all
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setOpenIds(new Set())}>
            Collapse all
          </Button>
        </span>
      </div>

      {view.classes.length === 0 ? (
        <div className="mt-8">
          <EmptyPanel icon="magnifier" title="No requirements match these filters"
            description={`This run declared ${entity.total} requirements; every active filter narrows the set.`}
            action={<Button size="sm" variant="secondary" onPress={clear}>Clear filters</Button>} />
        </div>
      ) : view.classes.map((cls) => (
        <div key={cls.name} className="mt-8">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold">{cls.name}</h3>
            <span className="text-xs text-muted">{cls.meta}</span>
          </div>
          {cls.jobs.map((job) => (
            <Job key={job.id} job={job}
              openIds={openIds} onExpandedChange={setOpenIds}
              collapsed={closedJobs.has(job.id)} onCollapse={() => collapseJob(job.id)} />
          ))}
        </div>
      ))}

      <p className="mt-10 text-xs text-muted">
        Generated on {WHEN.format(new Date(report.finishedAt ?? report.startedAt))} ·
        Run #{report.id} · Evidence retained for {report.evidenceRetentionDays} days
      </p>
    </div>
  );
}

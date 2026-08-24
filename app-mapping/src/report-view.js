// Derived views over validation reports. Pure over the fixture shape, like every
// other *-view module here, so the report page renders arithmetic it did not invent.

import {LANES, REPORTS, REQUIREMENT_STATUSES, TERMINAL_STATUSES} from "./fixtures.js";

/** Worst-first. A job's chip, and a report's gate, take the first status present. */
export const SEVERITY = ["fail", "blocked", "review", "flaky", "running", "queued",
  "skip", "pass"];

export const STATUS_LABEL = {
  pass: "passed", fail: "failed", flaky: "flaky", review: "needs review",
  blocked: "blocked", skip: "skipped", running: "running", queued: "queued",
};

const emptyCounts = () => Object.fromEntries(REQUIREMENT_STATUSES.map((s) => [s, 0]));

export function countByStatus(requirements) {
  const counts = emptyCounts();
  for (const r of requirements) counts[r.status] += 1;
  return counts;
}

const worst = (requirements) =>
  SEVERITY.find((s) => requirements.some((r) => r.status === s)) ?? "pass";

/**
 * The merge gate. Anything unfinished outranks a failure, because a run that has
 * not finished has not earned a verdict yet.
 */
export function gateOf(requirements) {
  if (requirements.length === 0) return "empty";
  if (requirements.some((r) => r.status === "running" || r.status === "queued")) return "running";
  if (requirements.some((r) => r.status === "fail")) return "blocked";
  return "ready";
}

export const GATE_COPY = {
  blocked: {
    label: "Merge blocked",
    chip: "Blocked",
    tone: "danger",
    line: (c) => `${c.fail} ${c.fail === 1 ? "requirement" : "requirements"} failed. ` +
      "Merging is blocked until each one passes or is explicitly accepted.",
  },
  ready: {
    label: "Ready to merge",
    chip: "Ready",
    tone: "success",
    line: (c) => `${c.pass} of ${c.pass + c.flaky + c.skip + c.review} ` +
      "requirements passed. Nothing is blocking this merge.",
  },
  running: {
    label: "Validation in progress",
    chip: "Running",
    tone: "accent",
    line: (c) => `${c.running + c.queued} ${c.running + c.queued === 1 ? "requirement is" : "requirements are"} ` +
      "still to finish. The verdict is withheld until they do.",
  },
  empty: {
    label: "Nothing validated",
    chip: "Empty",
    tone: "default",
    line: () => "This run declared no requirements.",
  },
};

const flatten = (report) =>
  report.classes.flatMap((cls) =>
    cls.jobs.flatMap((job) =>
      job.requirements.map((r) => ({...r, jobId: job.id, className: cls.name}))));

/** One row per report for the catalog. */
export function reportRows(now) {
  return REPORTS.map((report) => {
    const requirements = flatten(report);
    const counts = countByStatus(requirements);
    const finished = report.finishedAt ? new Date(report.finishedAt) : null;
    return {
      report,
      counts,
      total: requirements.length,
      gate: gateOf(requirements),
      jobCount: report.classes.reduce((n, c) => n + c.jobs.length, 0),
      lanes: [...new Set(report.classes.flatMap((c) => c.jobs.map((j) => j.laneId)).filter(Boolean))],
      ageDays: finished ? Math.floor((now - finished) / 86400000) : null,
    };
  }).sort((a, b) => Number(b.report.id) - Number(a.report.id));
}

/** The full report, with per-job rollups the page renders directly. */
export function reportEntity(id, now) {
  const report = REPORTS.find((r) => r.id === id);
  if (!report) return null;
  const requirements = flatten(report);
  const counts = countByStatus(requirements);
  const gate = gateOf(requirements);

  const classes = report.classes.map((cls) => {
    const jobs = cls.jobs.map((job) => {
      const jobCounts = countByStatus(job.requirements);
      return {
        ...job,
        lane: LANES.find((l) => l.id === job.laneId) ?? null,
        counts: jobCounts,
        total: job.requirements.length,
        status: worst(job.requirements),
        // Fixed order so the bar reads the same way on every job.
        segments: SEVERITY.filter((s) => jobCounts[s] > 0)
          .map((s) => ({status: s, count: jobCounts[s]})),
        summary: summarise(jobCounts, job.requirements.length),
      };
    });
    const clsRequirements = cls.jobs.flatMap((j) => j.requirements);
    return {
      name: cls.name,
      jobs,
      total: clsRequirements.length,
      meta: summarise(countByStatus(clsRequirements), clsRequirements.length),
    };
  });

  const finished = report.finishedAt ? new Date(report.finishedAt) : null;
  return {
    report,
    classes,
    requirements,
    counts,
    total: requirements.length,
    gate,
    settled: requirements.filter((r) => TERMINAL_STATUSES.includes(r.status)).length,
    ageDays: finished ? Math.floor((now - finished) / 86400000) : null,
  };
}

function summarise(counts, total) {
  const parts = SEVERITY.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${STATUS_LABEL[s]}`);
  return `${total} ${total === 1 ? "requirement" : "requirements"} · ${parts.join(" · ")}`;
}

/**
 * Narrows the report without collapsing its shape — a job that loses every
 * requirement is dropped, so the page never renders an empty accordion.
 */
export function filterReport(entity, {status = null, q = null} = {}) {
  const needle = q?.trim().toLowerCase() || null;
  const keep = (r) =>
    (!status || r.status === status) &&
    (!needle || [r.id, r.given, r.when, r.then, r.message, r.note]
      .some((s) => s?.toLowerCase().includes(needle)));

  const classes = entity.classes.map((cls) => ({
    ...cls,
    jobs: cls.jobs.map((job) => ({...job, requirements: job.requirements.filter(keep)}))
      .filter((job) => job.requirements.length > 0),
  })).filter((cls) => cls.jobs.length > 0);

  const shown = classes.reduce((n, c) =>
    n + c.jobs.reduce((m, j) => m + j.requirements.length, 0), 0);
  return {...entity, classes, shown, isFiltered: Boolean(status || needle)};
}

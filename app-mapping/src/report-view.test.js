import {test} from "node:test";
import assert from "node:assert/strict";
import {GATE_COPY, countByStatus, filterReport, gateOf, reportEntity, reportRows}
  from "./report-view.js";
import {REPORTS, REQUIREMENT_STATUSES, SCREENS} from "./fixtures.js";

const NOW = new Date("2026-08-23T12:00:00Z");
const st = (...statuses) => statuses.map((s) => ({status: s}));

test("countByStatus covers every declared status, including the zeroes", () => {
  const counts = countByStatus(st("pass", "pass", "fail"));
  assert.deepEqual(Object.keys(counts).sort(), [...REQUIREMENT_STATUSES].sort());
  assert.equal(counts.pass, 2);
  assert.equal(counts.fail, 1);
  assert.equal(counts.skip, 0);
});

test("an unfinished run outranks a failure — no verdict before the run ends", () => {
  assert.equal(gateOf(st("pass", "fail")), "blocked");
  assert.equal(gateOf(st("pass", "fail", "running")), "running");
  assert.equal(gateOf(st("pass", "fail", "queued")), "running");
  assert.equal(gateOf(st("pass", "pass")), "ready");
  assert.equal(gateOf(st("pass", "flaky", "skip", "review", "blocked")), "ready");
  assert.equal(gateOf([]), "empty");
});

test("every gate has copy, and the blocked line counts the actual failures", () => {
  for (const gate of ["blocked", "ready", "running", "empty"]) {
    assert.ok(GATE_COPY[gate], `no copy for ${gate}`);
    assert.equal(typeof GATE_COPY[gate].line(countByStatus([])), "string");
  }
  const line = GATE_COPY.blocked.line(countByStatus(st("fail", "fail", "pass")));
  assert.match(line, /^2 requirements failed/);
  assert.match(GATE_COPY.blocked.line(countByStatus(st("fail"))), /^1 requirement failed/);
});

test("catalog rows run newest first and carry a gate each", () => {
  const rows = reportRows(NOW);
  assert.equal(rows.length, REPORTS.length);
  assert.deepEqual(rows.map((r) => r.report.id), ["1286", "1284", "1281"]);
  assert.deepEqual(rows.map((r) => r.gate), ["running", "blocked", "ready"]);
  const blocked = rows.find((r) => r.report.id === "1284");
  assert.equal(blocked.total, 14);
  assert.equal(blocked.jobCount, 4);
  assert.deepEqual(blocked.lanes, ["meals-android", "meals-ios", "bazaar-android"]);
  // an unfinished run has no age, rather than a fabricated one
  assert.equal(rows.find((r) => r.report.id === "1286").ageDays, null);
});

test("the flagship report's arithmetic", () => {
  const e = reportEntity("1284", NOW);
  assert.equal(e.gate, "blocked");
  assert.equal(e.total, 14);
  assert.equal(e.settled, 11);
  assert.deepEqual(e.counts, {pass: 7, fail: 2, flaky: 1, review: 1, blocked: 2, skip: 1,
    running: 0, queued: 0});
  // counts must partition the requirements exactly
  assert.equal(Object.values(e.counts).reduce((a, b) => a + b, 0), e.total);
});

test("a job's status is its worst requirement, and its bar sums to its total", () => {
  const e = reportEntity("1284", NOW);
  const jobs = e.classes.flatMap((c) => c.jobs);
  assert.deepEqual(jobs.map((j) => j.id), ["meals-android", "meals-ios", "bazaar-android", "api"]);
  const android = jobs.find((j) => j.id === "meals-android");
  assert.equal(android.status, "fail");
  assert.equal(android.total, 5);
  assert.equal(android.segments.reduce((n, s) => n + s.count, 0), android.total);
  // severity order, worst first
  assert.deepEqual(android.segments.map((s) => s.status), ["fail", "flaky", "skip", "pass"]);
  // blocked outranks review and pass
  assert.equal(jobs.find((j) => j.id === "meals-ios").status, "blocked");
  // a job bound to a lane resolves it; the contract job has none
  assert.equal(android.lane.id, "meals-android");
  assert.equal(jobs.find((j) => j.id === "api").lane, null);
});

test("filtering narrows without leaving empty jobs or classes behind", () => {
  const e = reportEntity("1284", NOW);
  const failures = filterReport(e, {status: "fail"});
  assert.equal(failures.shown, 2);
  assert.equal(failures.isFiltered, true);
  for (const cls of failures.classes) {
    assert.ok(cls.jobs.length > 0);
    for (const job of cls.jobs) assert.ok(job.requirements.length > 0);
  }
  const none = filterReport(e, {status: "queued"});
  assert.equal(none.shown, 0);
  assert.deepEqual(none.classes, []);
  const unfiltered = filterReport(e, {});
  assert.equal(unfiltered.shown, e.total);
  assert.equal(unfiltered.isFiltered, false);
});

test("search reads the Given/When/Then text, not just the id", () => {
  const e = reportEntity("1284", NOW);
  assert.equal(filterReport(e, {q: "VR-102"}).shown, 1);
  assert.ok(filterReport(e, {q: "tipping"}).shown > 1);
  assert.equal(filterReport(e, {q: "   "}).shown, e.total, "blank search must not filter");
  assert.equal(filterReport(e, {q: "zzzz"}).shown, 0);
});

test("every requirement cites screens that actually exist in the map", () => {
  for (const report of REPORTS) {
    for (const cls of report.classes) {
      for (const job of cls.jobs) {
        for (const r of job.requirements) {
          for (const key of r.screens ?? []) {
            assert.ok(SCREENS[key], `${r.id} cites unknown screen ${key}`);
          }
        }
      }
    }
  }
});

test("requirement ids are unique across the whole corpus", () => {
  const ids = REPORTS.flatMap((r) => r.classes.flatMap((c) =>
    c.jobs.flatMap((j) => j.requirements.map((x) => x.id))));
  assert.equal(new Set(ids).size, ids.length);
});

test("an unknown report id returns null rather than an empty shell", () => {
  assert.equal(reportEntity("nope", NOW), null);
});

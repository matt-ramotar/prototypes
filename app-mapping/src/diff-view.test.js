import {test} from "node:test";
import assert from "node:assert/strict";
import {MARKET_LOCALE, counterpartQuery} from "./diff-view.js";

const BASE = {journey: "onboarding", container: "meals", platform: "android", cohort: "new",
  locale: "de-DE", market: "DE", build: "8.112", pivot: "market", counterpart: "US",
  view: "report", screen: null};

test("market pivot DE-base to US: locale becomes en-US, pivot/counterpart nulled, other fields untouched", () => {
  const q = counterpartQuery(BASE);
  assert.equal(q.market, "US");
  assert.equal(q.locale, MARKET_LOCALE.US);
  assert.equal(q.locale, "en-US");
  assert.equal(q.pivot, null);
  assert.equal(q.counterpart, null);
  assert.equal(q.journey, BASE.journey);
  assert.equal(q.container, BASE.container);
  assert.equal(q.platform, BASE.platform);
  assert.equal(q.cohort, BASE.cohort);
  assert.equal(q.build, BASE.build);
  assert.equal(q.view, BASE.view);
  assert.equal(q.screen, BASE.screen);
});

test("build pivot: only build changes, locale untouched", () => {
  const base = {...BASE, pivot: "build", counterpart: "8.98", locale: "en-US", market: "US"};
  const q = counterpartQuery(base);
  assert.equal(q.build, "8.98");
  assert.equal(q.locale, base.locale);
  assert.equal(q.market, base.market);
  assert.equal(q.pivot, null);
  assert.equal(q.counterpart, null);
});

test("unknown market counterpart (UK): locale unchanged, pivot/counterpart nulled", () => {
  const base = {...BASE, locale: "en-US", market: "US", counterpart: "UK"};
  const q = counterpartQuery(base);
  assert.equal(q.market, "UK");
  assert.equal(q.locale, base.locale);
  assert.equal(q.pivot, null);
  assert.equal(q.counterpart, null);
});

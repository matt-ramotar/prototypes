import {test} from "node:test";
import assert from "node:assert/strict";
import {matchRoute, pathFor, legacyRedirect} from "./routes.js";

test("list and entity routes match with decoded params", () => {
  assert.deepEqual(matchRoute("/"), {page: "atlas", params: {}, note: null});
  assert.deepEqual(matchRoute("/map"), {page: "map", params: {}, note: null});
  assert.deepEqual(matchRoute("/screens"), {page: "screens", params: {}, note: null});
  assert.deepEqual(matchRoute("/screens/onb%2Fphone%2377c1"),
    {page: "screen", params: {key: "onb/phone#77c1"}, note: null});
  assert.deepEqual(matchRoute("/journeys/onboarding"),
    {page: "journey", params: {id: "onboarding"}, note: null});
  assert.deepEqual(matchRoute("/lanes/meals-android"),
    {page: "lane", params: {id: "meals-android"}, note: null});
  assert.deepEqual(matchRoute("/builds/8.112"),
    {page: "build", params: {id: "8.112"}, note: null});
  assert.deepEqual(matchRoute("/ask"), {page: "ask", params: {}, note: null});
});

test("unknown paths degrade to atlas with a note", () => {
  const r = matchRoute("/nonsense/deep");
  assert.equal(r.page, "atlas");
  assert.match(r.note, /Unknown path/);
});

test("pathFor round-trips the screen key encoding", () => {
  const p = pathFor("screen", "onb/phone#77c1");
  assert.equal(p, "/screens/onb%2Fphone%2377c1");
  assert.equal(matchRoute(p).params.key, "onb/phone#77c1");
  assert.equal(pathFor("journeys"), "/journeys");
  assert.equal(pathFor("map"), "/map");
});

test("legacy root URLs with v1 query params redirect to /map", () => {
  assert.equal(legacyRedirect("/", "?journey=onboarding&container=meals"), "/map?journey=onboarding&container=meals");
  assert.equal(legacyRedirect("/", "?container=meals"), "/map?container=meals");
  assert.equal(legacyRedirect("/", ""), null);
  assert.equal(legacyRedirect("/screens", "?journey=onboarding"), null);
});

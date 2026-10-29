import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchRouteText,
  isDeviceTypeRepo,
  isStructurallyExcluded,
  parseRoute,
  resolveRepoAuthorization,
} from "./route-reader.mjs";

test("parseRoute parses valid JSON with a repos object", () => {
  const route = parseRoute('{"repos": {"a": {}}}');
  assert.deepEqual(route.repos, { a: {} });
});
test("parseRoute rejects a route with no repos object", () =>
  assert.throws(() => parseRoute('{"org": "openIndu"}'), /no repos object/));
test("parseRoute rejects invalid JSON", () =>
  assert.throws(() => parseRoute("{not json")));

for (const type of ["control-tower", "aggregate", "gitops", "fork", "meta"]) {
  test(`${type} is structurally excluded`, () =>
    assert.equal(isStructurallyExcluded(type), true));
}
test("an ordinary repo type is not structurally excluded", () =>
  assert.equal(isStructurallyExcluded("backend"), false));

for (const type of ["station", "controller", "vision", "cim", "studio"]) {
  test(`${type} is a device-type repo`, () =>
    assert.equal(isDeviceTypeRepo({ type }), true));
}
test("delivery_owner: station-control also counts as device-type", () =>
  assert.equal(
    isDeviceTypeRepo({ type: "fork", delivery_owner: "station-control" }),
    true,
  ));
test("an ordinary repo is not device-type", () =>
  assert.equal(isDeviceTypeRepo({ type: "backend" }), false));

test("fetchRouteText decodes a base64 GitHub contents response", () => {
  const fakeGithub = (endpoint, fields) => {
    assert.equal(
      endpoint,
      "repos/openIndu/control-tower/contents/plugins/openindu-control-tower/reference/route.json",
    );
    assert.deepEqual(fields, { ref: "main" });
    return {
      encoding: "base64",
      content: Buffer.from('{"repos":{}}', "utf8").toString("base64"),
    };
  };
  assert.equal(fetchRouteText("main", undefined, fakeGithub), '{"repos":{}}');
});
test("fetchRouteText rejects a non-base64 response rather than mis-decoding it", () =>
  assert.throws(
    () => fetchRouteText("main", undefined, () => ({ encoding: "utf8", content: "x" })),
    /Unexpected content encoding/,
  ));

const now = new Date("2026-10-29T00:00:00Z");

test("resolveRepoAuthorization fails when the repo is not in route.json", () =>
  assert.equal(
    resolveRepoAuthorization({ repos: {} }, "ghost", now).authorized,
    false,
  ));
test("resolveRepoAuthorization fails for a structurally excluded type even if listed in a grant", () => {
  const route = {
    dev_grants: [{ repos: ["control-tower"], expires_on: "2099-01-01" }],
    repos: { "control-tower": { type: "control-tower" } },
  };
  const verdict = resolveRepoAuthorization(route, "control-tower", now);
  assert.equal(verdict.authorized, false);
  assert.match(verdict.reason, /structurally excluded/);
});
test("resolveRepoAuthorization fails for a device-type repo with no dev.safety_paths, even if listed in a grant", () => {
  const route = {
    dev_grants: [{ repos: ["openindu-studio"], expires_on: "2099-01-01" }],
    repos: { "openindu-studio": { type: "studio" } },
  };
  const verdict = resolveRepoAuthorization(route, "openindu-studio", now);
  assert.equal(verdict.authorized, false);
  assert.match(verdict.reason, /safety_paths/);
});
test("resolveRepoAuthorization passes for a device-type repo once safety_paths is registered and it is granted", () => {
  const route = {
    dev_grants: [{ repos: ["openindu-studio"], expires_on: "2099-01-01" }],
    repos: {
      "openindu-studio": {
        type: "studio",
        dev: { safety_paths: ["converters/circuit/**"] },
      },
    },
  };
  const verdict = resolveRepoAuthorization(route, "openindu-studio", now);
  assert.equal(verdict.authorized, true);
});
test("resolveRepoAuthorization fails when no grant lists the repo", () => {
  const route = { dev_grants: [], repos: { backend: { type: "backend" } } };
  assert.equal(resolveRepoAuthorization(route, "backend", now).authorized, false);
});
test("resolveRepoAuthorization fails when the matching grant has expired", () => {
  const route = {
    dev_grants: [{ repos: ["backend"], expires_on: "2026-01-01" }],
    repos: { backend: { type: "backend" } },
  };
  const verdict = resolveRepoAuthorization(route, "backend", now);
  assert.equal(verdict.authorized, false);
  assert.match(verdict.reason, /expired/);
});
test("resolveRepoAuthorization passes for an ordinary repo with an unexpired grant naming it", () => {
  const route = {
    dev_grants: [{ id: "g1", repos: ["backend"], expires_on: "2099-01-01" }],
    repos: { backend: { type: "backend" } },
  };
  const verdict = resolveRepoAuthorization(route, "backend", now);
  assert.equal(verdict.authorized, true);
  assert.equal(verdict.grant.id, "g1");
});
test("resolveRepoAuthorization does not let an unrelated grant authorize a repo it does not list", () => {
  const route = {
    dev_grants: [{ repos: ["other-repo"], expires_on: "2099-01-01" }],
    repos: { backend: { type: "backend" } },
  };
  assert.equal(resolveRepoAuthorization(route, "backend", now).authorized, false);
});

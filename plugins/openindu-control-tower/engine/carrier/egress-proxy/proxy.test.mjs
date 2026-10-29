import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedHost, parseAllowedHosts } from "./proxy.mjs";

test("parseAllowedHosts splits, trims, and drops empty entries", () =>
  assert.deepEqual(parseAllowedHosts(" api.anthropic.com , other.example.com ,,"), [
    "api.anthropic.com",
    "other.example.com",
  ]));
test("parseAllowedHosts returns an empty list for undefined/empty input", () => {
  assert.deepEqual(parseAllowedHosts(undefined), []);
  assert.deepEqual(parseAllowedHosts(""), []);
});

test("isAllowedHost is true only for an exact match in the list", () => {
  const allowed = ["api.anthropic.com"];
  assert.equal(isAllowedHost("api.anthropic.com", allowed), true);
  assert.equal(isAllowedHost("api.github.com", allowed), false);
});
test("isAllowedHost does not substring-match a lookalike host", () =>
  assert.equal(isAllowedHost("api.anthropic.com.evil.example", ["api.anthropic.com"]), false));
test("isAllowedHost rejects everything when the allowlist is empty", () =>
  assert.equal(isAllowedHost("api.anthropic.com", []), false));

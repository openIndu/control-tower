import assert from "node:assert/strict";
import test from "node:test";

import { redactSecrets } from "./log-redaction.mjs";

test("redacts a GitHub personal access token", () => {
  const out = redactSecrets("using token ghp_1234567890abcdefghijABCDEFGHIJ for the request");
  assert.ok(!out.includes("ghp_1234567890"));
  assert.ok(out.includes("[REDACTED]"));
});
test("redacts an Anthropic API key", () => {
  const out = redactSecrets("ANTHROPIC_API_KEY is sk-ant-api03-abcdefghijklmnopqrstuvwxyz");
  assert.ok(!out.includes("sk-ant-api03-abcdefghijklmnopqrstuvwxyz"));
});
test("redacts an AWS access key id", () => {
  const out = redactSecrets("AKIAABCDEFGHIJ123456 was used");
  assert.ok(!out.includes("AKIAABCDEFGHIJ123456"));
});
test("redacts the value of an Authorization: Bearer header but keeps the scheme", () => {
  const out = redactSecrets("Authorization: Bearer abc.def.ghi-1234567890");
  assert.ok(out.startsWith("Authorization: Bearer [REDACTED]"));
  assert.ok(!out.includes("abc.def.ghi"));
});
test("redacts a *_TOKEN=value assignment while keeping the variable name", () => {
  const out = redactSecrets("GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234");
  assert.ok(out.startsWith("GITHUB_TOKEN="));
  assert.ok(!out.includes("ghp_abcdefghijklmnopqrstuvwxyz1234"));
});
test("redacts a *_SECRET: value assignment", () => {
  const out = redactSecrets("WEBHOOK_SECRET: s3cr3t-value-here");
  assert.ok(out.startsWith("WEBHOOK_SECRET:"));
  assert.ok(!out.includes("s3cr3t-value-here"));
});
test("leaves ordinary, non-credential-shaped text untouched", () => {
  const text = "the build took 42 seconds and 3 tests passed";
  assert.equal(redactSecrets(text), text);
});
test("does not touch a bare *_KEY assignment with no API/TOKEN/SECRET/PASSWORD in the name", () => {
  const text = "PRIMARY_KEY = id";
  assert.equal(redactSecrets(text), text);
});

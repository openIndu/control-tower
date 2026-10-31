import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  appendTraceEntry,
  traceFileName,
  withTraceLogging,
} from "./trace-log.mjs";

test("traceFileName matches docs-dir.mjs's per-issue naming convention", () => {
  assert.equal(traceFileName(42), "issue-42-trace.jsonl");
});

test("appendTraceEntry writes one redacted JSON line per call, creating the docs dir", () => {
  const scratch = mkdtempSync(join(tmpdir(), "trace-log-test-"));
  try {
    const docsDir = join(scratch, "mem_docs", "backend", "dev-runs", "run-1");
    const fileName = traceFileName(1);
    appendTraceEntry(
      docsDir,
      fileName,
      { label: "scoping", rawStdout: "line one" },
      (text) => text,
    );
    appendTraceEntry(
      docsDir,
      fileName,
      { label: "implement", rawStdout: "line two" },
      (text) => text,
    );
    const lines = readFileSync(join(docsDir, fileName), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].label, "scoping");
    assert.equal(lines[0].stdout, "line one");
    assert.equal(lines[1].label, "implement");
    assert.equal(lines[1].stdout, "line two");
    assert.ok(lines[0].at);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("appendTraceEntry redacts the raw stdout through the given redact function before writing", () => {
  const scratch = mkdtempSync(join(tmpdir(), "trace-log-test-"));
  try {
    const docsDir = join(scratch, "docs");
    appendTraceEntry(
      docsDir,
      "t.jsonl",
      { label: "x", rawStdout: "token=sk-ant-SECRET" },
      () => "[REDACTED LINE]",
    );
    const line = JSON.parse(readFileSync(join(docsDir, "t.jsonl"), "utf8"));
    assert.equal(line.stdout, "[REDACTED LINE]");
    assert.ok(!line.stdout.includes("sk-ant-SECRET"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("withTraceLogging appends a successful call's rawStdout and returns the result unchanged", async () => {
  const appended = [];
  const fn = async (a) => ({ summary: "x", rawStdout: "raw trace", a });
  const tracked = withTraceLogging(
    fn,
    (entry) => appended.push(entry),
    "implement",
  );
  const result = await tracked(1);
  assert.deepEqual(result, { summary: "x", rawStdout: "raw trace", a: 1 });
  assert.deepEqual(appended, [{ label: "implement", rawStdout: "raw trace" }]);
});

test("withTraceLogging does not append when the result has no string rawStdout (e.g. a bare array, or a fake with no trace modeled)", async () => {
  const appended = [];
  const append = (entry) => appended.push(entry);

  const arrayFn = withTraceLogging(
    async () => ["Log in", "Check the field"],
    append,
    "x",
  );
  await arrayFn();

  const noTraceFn = withTraceLogging(
    async () => ({ summary: "x" }),
    append,
    "x",
  );
  await noTraceFn();

  assert.equal(appended.length, 0);
});

test("withTraceLogging propagates a thrown error without appending", async () => {
  let appendCalled = false;
  const failing = withTraceLogging(
    async () => {
      throw new Error("carrier invocation did not succeed");
    },
    () => {
      appendCalled = true;
    },
    "x",
  );
  await assert.rejects(() => failing(), /did not succeed/);
  assert.equal(appendCalled, false);
});

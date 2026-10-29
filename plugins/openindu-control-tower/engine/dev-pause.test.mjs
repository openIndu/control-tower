import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { isPaused, writePause } from "./dev-pause.mjs";

test("isPaused is false when no pause file exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-pause-test-"));
  try {
    assert.equal(isPaused(join(dir, ".dev-pause")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writePause creates the file, and isPaused then reports true", () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-pause-test-"));
  try {
    const pauseFile = join(dir, ".dev-pause");
    writePause(pauseFile, "circuit breaker: red default-branch CI post-merge");
    assert.equal(isPaused(pauseFile), true);
    const content = JSON.parse(readFileSync(pauseFile, "utf8"));
    assert.equal(content.reason, "circuit breaker: red default-branch CI post-merge");
    assert.equal(typeof content.pausedAt, "string");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writePause creates intermediate directories if needed", () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-pause-test-"));
  try {
    const pauseFile = join(dir, "nested", "run", ".dev-pause");
    writePause(pauseFile, "test");
    assert.equal(isPaused(pauseFile), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("there is no exported clear/remove function -- only a human clears a pause, by deleting the file directly", async () => {
  const module = await import("./dev-pause.mjs");
  const exportNames = Object.keys(module);
  assert.deepEqual(exportNames.sort(), ["DEFAULT_PAUSE_FILE_NAME", "isPaused", "writePause"]);
});

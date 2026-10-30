import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  acquireRunLock,
  createRunState,
  getIssueState,
  hasMerged,
  hasOpenedPr,
  hasPromotedToReady,
  loadRunState,
  markAcked,
  markMerged,
  markPrOpened,
  markPromotedToReady,
  releaseRunLock,
  RunLockHeldError,
  saveRunState,
} from "./run-state.mjs";

test("a fresh run state has no issues marked yet", () => {
  const state = createRunState({ runId: "run-1", repoName: "openindu-studio" });
  assert.equal(hasOpenedPr(state, 76), false);
  assert.equal(hasMerged(state, 76), false);
});

test("markPrOpened / markPromotedToReady / markMerged are idempotency flags for one issue, and do not mutate the input", () => {
  const s0 = createRunState({ runId: "run-1", repoName: "r" });
  const s1 = markPrOpened(s0, 76, 101);
  assert.equal(hasOpenedPr(s0, 76), false, "input state must not be mutated");
  assert.equal(hasOpenedPr(s1, 76), true);
  assert.equal(getIssueState(s1, 76).prNumber, 101);

  const s2 = markPromotedToReady(s1, 76);
  assert.equal(hasPromotedToReady(s1, 76), false);
  assert.equal(hasPromotedToReady(s2, 76), true);

  const s3 = markMerged(s2, 76, { mergeSha: "abc123" });
  assert.equal(hasMerged(s2, 76), false);
  assert.equal(hasMerged(s3, 76), true);
  assert.equal(getIssueState(s3, 76).mergeSha, "abc123");
  // earlier flags on the same issue survive later patches
  assert.equal(hasOpenedPr(s3, 76), true);
  assert.equal(hasPromotedToReady(s3, 76), true);
});

test("markAcked records ackAt without disturbing other issues in the same state", () => {
  let state = createRunState({ runId: "run-1", repoName: "r" });
  state = markMerged(state, 76, { mergeSha: "abc" });
  state = markMerged(state, 77, { mergeSha: "def" });
  state = markAcked(state, 76, { ackAt: "2026-10-30T00:00:00.000Z" });
  assert.equal(getIssueState(state, 76).ackAt, "2026-10-30T00:00:00.000Z");
  assert.equal(getIssueState(state, 77).ackAt, null);
});

test("saveRunState then loadRunState round-trips exactly", () => {
  const dir = mkdtempSync(join(tmpdir(), "run-state-test-"));
  try {
    let state = createRunState({ runId: "run-1", repoName: "openindu-studio" });
    state = markPrOpened(state, 76, 101);
    const path = join(dir, "nested", "state.json");
    saveRunState(path, state);
    const loaded = loadRunState(path);
    assert.deepEqual(loaded, state);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireRunLock blocks a different runId, but is idempotent for the same runId (--resume)", () => {
  const dir = mkdtempSync(join(tmpdir(), "run-state-test-"));
  try {
    const lockPath = join(dir, "run.lock");
    acquireRunLock(lockPath, "run-1");
    assert.doesNotThrow(() => acquireRunLock(lockPath, "run-1"));
    assert.throws(() => acquireRunLock(lockPath, "run-2"), RunLockHeldError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("releaseRunLock only removes a lock that currently names this runId", () => {
  const dir = mkdtempSync(join(tmpdir(), "run-state-test-"));
  try {
    const lockPath = join(dir, "run.lock");
    acquireRunLock(lockPath, "run-1");
    releaseRunLock(lockPath, "run-2"); // a stale/foreign runId must not delete someone else's lock
    assert.throws(() => acquireRunLock(lockPath, "run-3"), RunLockHeldError);
    releaseRunLock(lockPath, "run-1");
    assert.doesNotThrow(() => acquireRunLock(lockPath, "run-3"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("releaseRunLock on a path with no lock file is a no-op, not an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "run-state-test-"));
  try {
    assert.doesNotThrow(() =>
      releaseRunLock(join(dir, "never-created.lock"), "run-1"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

// spec/005 section 2.1: "每次运行有 run-id 与 state.json，每步幂等（不重复开 PR、不
// 重复合并），可 --resume". Every mutator here returns a NEW state object (same
// functional style as the rest of engine/) so a caller can log/diff before and after,
// and so a crashed write never leaves a half-mutated in-memory state lingering.

export function createRunState({
  runId,
  repoName,
  startedAt = new Date().toISOString(),
}) {
  return { runId, repoName, startedAt, issues: {} };
}

function emptyIssueState() {
  return {
    openedPr: false,
    prNumber: null,
    promotedToReady: false,
    merged: false,
    mergeSha: null,
    mergedAt: null,
    ackAt: null,
  };
}

function issueState(state, issueNumber) {
  return state.issues[issueNumber] ?? emptyIssueState();
}

function withIssueState(state, issueNumber, patch) {
  return {
    ...state,
    issues: {
      ...state.issues,
      [issueNumber]: { ...issueState(state, issueNumber), ...patch },
    },
  };
}

export function hasOpenedPr(state, issueNumber) {
  return issueState(state, issueNumber).openedPr;
}

export function markPrOpened(state, issueNumber, prNumber) {
  return withIssueState(state, issueNumber, { openedPr: true, prNumber });
}

export function hasPromotedToReady(state, issueNumber) {
  return issueState(state, issueNumber).promotedToReady;
}

export function markPromotedToReady(state, issueNumber) {
  return withIssueState(state, issueNumber, { promotedToReady: true });
}

export function hasMerged(state, issueNumber) {
  return issueState(state, issueNumber).merged;
}

export function markMerged(
  state,
  issueNumber,
  { mergeSha, mergedAt = new Date().toISOString() },
) {
  return withIssueState(state, issueNumber, {
    merged: true,
    mergeSha,
    mergedAt,
  });
}

export function markAcked(
  state,
  issueNumber,
  { ackAt = new Date().toISOString() } = {},
) {
  return withIssueState(state, issueNumber, { ackAt });
}

export function getIssueState(state, issueNumber) {
  return issueState(state, issueNumber);
}

export function saveRunState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

export function loadRunState(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Single-run-per-repo lock (spec/005 section 2.1: "同一仓同时只允许一个运行（锁文
// 件）"). Reacquiring the SAME runId is idempotent -- that is exactly what --resume
// does after an interrupted run, not a race to guard against. A different runId
// finding the lock held throws; it never silently waits or steals the lock.
export class RunLockHeldError extends Error {
  constructor(heldByRunId) {
    super(`run lock is already held by run ${heldByRunId}`);
    this.heldByRunId = heldByRunId;
  }
}

export function acquireRunLock(lockFilePath, runId) {
  if (existsSync(lockFilePath)) {
    const existing = JSON.parse(readFileSync(lockFilePath, "utf8"));
    if (existing.runId !== runId) {
      throw new RunLockHeldError(existing.runId);
    }
    return; // resuming our own run -- idempotent
  }
  mkdirSync(dirname(lockFilePath), { recursive: true });
  writeFileSync(
    lockFilePath,
    `${JSON.stringify({ runId, pid: process.pid, acquiredAt: new Date().toISOString() }, null, 2)}\n`,
  );
}

// Only releases a lock that currently names this runId -- never blind-deletes
// whatever happens to be at that path, which could belong to a different run that
// reacquired it after this one crashed without releasing.
export function releaseRunLock(lockFilePath, runId) {
  if (!existsSync(lockFilePath)) return;
  const existing = JSON.parse(readFileSync(lockFilePath, "utf8"));
  if (existing.runId === runId) {
    rmSync(lockFilePath);
  }
}

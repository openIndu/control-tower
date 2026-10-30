import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  checkForRollbackAndPause,
  evaluateCircuitBreakerAfterMerge,
  executeMerge,
  readBackMergeState,
  verifyMergedTreeMatchesReviewed,
} from "./merge-execute.mjs";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function commit(dir, fileName, content) {
  writeFileSync(join(dir, fileName), content);
  git(["add", "."], dir);
  git(
    [
      "-c",
      "user.email=t@example.com",
      "-c",
      "user.name=t",
      "commit",
      "-q",
      "-m",
      fileName,
    ],
    dir,
  );
  return git(["rev-parse", "HEAD"], dir).trim();
}

test("executeMerge never includes --admin, and uses squash + delete-branch + match-head-commit", () => {
  let capturedArgs;
  executeMerge(
    { repoPath: "openIndu/control-tower", prNumber: 33, headSha: "deadbeef" },
    (args) => {
      capturedArgs = args;
    },
  );
  assert.ok(!capturedArgs.includes("--admin"));
  assert.ok(capturedArgs.includes("--squash"));
  assert.ok(capturedArgs.includes("--delete-branch"));
  const matchIdx = capturedArgs.indexOf("--match-head-commit");
  assert.ok(matchIdx >= 0);
  assert.equal(capturedArgs[matchIdx + 1], "deadbeef");
});

test("readBackMergeState maps a merged PR's real gh JSON shape", () => {
  const result = readBackMergeState({ repoPath: "r", prNumber: 1 }, () => ({
    state: "MERGED",
    mergedAt: "2026-10-30T03:09:32Z",
    mergeCommit: { oid: "abc123" },
  }));
  assert.deepEqual(result, {
    merged: true,
    mergeCommit: "abc123",
    mergedAt: "2026-10-30T03:09:32Z",
  });
});

test("readBackMergeState reports merged:false and a null mergeCommit for a still-open PR", () => {
  const result = readBackMergeState({ repoPath: "r", prNumber: 1 }, () => ({
    state: "OPEN",
    mergedAt: null,
    mergeCommit: null,
  }));
  assert.deepEqual(result, {
    merged: false,
    mergeCommit: null,
    mergedAt: null,
  });
});

test("verifyMergedTreeMatchesReviewed reports a match when the merge commit's tree equals the reviewed commit's, for the given paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "merge-execute-test-"));
  try {
    git(["init", "-q", "-b", "main", dir]);
    const reviewedSha = commit(dir, "a.txt", "reviewed content\n");
    // simulate "squash merge produced an identical tree for this path" by not
    // changing a.txt again -- a second commit on an unrelated file stands in for
    // the merge commit, same tree for a.txt.
    const mergeCommitSha = commit(dir, "b.txt", "unrelated\n");
    const result = verifyMergedTreeMatchesReviewed(
      {
        repoPath: dir,
        reviewedSha,
        mergeCommit: mergeCommitSha,
        paths: ["a.txt"],
      },
      (args, cwd) => git(args, cwd),
    );
    assert.deepEqual(result, { match: true, differingPaths: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyMergedTreeMatchesReviewed reports a mismatch and names the differing path when the tree changed", () => {
  const dir = mkdtempSync(join(tmpdir(), "merge-execute-test-"));
  try {
    git(["init", "-q", "-b", "main", dir]);
    const reviewedSha = commit(dir, "a.txt", "reviewed content\n");
    const mergeCommitSha = commit(dir, "a.txt", "changed after review\n");
    const result = verifyMergedTreeMatchesReviewed(
      {
        repoPath: dir,
        reviewedSha,
        mergeCommit: mergeCommitSha,
        paths: ["a.txt"],
      },
      (args, cwd) => git(args, cwd),
    );
    assert.equal(result.match, false);
    assert.deepEqual(result.differingPaths, ["a.txt"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evaluateCircuitBreakerAfterMerge writes .dev-pause with the tripped reason when a condition fires", () => {
  let pauseCall;
  const verdict = evaluateCircuitBreakerAfterMerge(
    {
      ciTurnedRedPostMerge: true,
      nonRunnerMergeDetected: false,
      twoConsecutiveBlockedIssues: false,
      repeatedToolErrors: false,
    },
    "/fake/.dev-pause",
    (path, reason) => {
      pauseCall = { path, reason };
    },
  );
  assert.equal(verdict.tripped, true);
  assert.equal(pauseCall.path, "/fake/.dev-pause");
  assert.match(pauseCall.reason, /circuit breaker/);
  assert.match(pauseCall.reason, /CI turned red/);
});

test("evaluateCircuitBreakerAfterMerge does not write .dev-pause when nothing tripped", () => {
  let pauseCalled = false;
  const verdict = evaluateCircuitBreakerAfterMerge(
    {
      ciTurnedRedPostMerge: false,
      nonRunnerMergeDetected: false,
      twoConsecutiveBlockedIssues: false,
      repeatedToolErrors: false,
    },
    "/fake/.dev-pause",
    () => {
      pauseCalled = true;
    },
  );
  assert.equal(verdict.tripped, false);
  assert.equal(pauseCalled, false);
});

test("checkForRollbackAndPause writes .dev-pause naming the reverted SHA when a recorded merge was reverted", () => {
  let pauseCall;
  const detected = checkForRollbackAndPause(
    {
      defaultBranchCommitMessages: [
        "revert: oops\n\nThis reverts commit abc1234567.",
      ],
      recordedMergeShas: ["abc1234567890"],
    },
    "/fake/.dev-pause",
    (path, reason) => {
      pauseCall = { path, reason };
    },
  );
  assert.equal(detected.length, 1);
  assert.match(pauseCall.reason, /rollback detected/);
  assert.match(pauseCall.reason, /abc1234567890/);
});

test("checkForRollbackAndPause does not write .dev-pause when no revert of a recorded merge is found", () => {
  let pauseCalled = false;
  const detected = checkForRollbackAndPause(
    {
      defaultBranchCommitMessages: ["feat: unrelated change"],
      recordedMergeShas: ["abc1234567890"],
    },
    "/fake/.dev-pause",
    () => {
      pauseCalled = true;
    },
  );
  assert.equal(detected.length, 0);
  assert.equal(pauseCalled, false);
});

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runStep4 } from "./pr-and-merge.mjs";

// Facts shaped to pass every guard pr-lifecycle.mjs's evaluatePromotionReadiness /
// evaluatePostPromotionRecheck call -- same fixture style as pr-lifecycle.test.mjs's
// own ALL_PASS_FACTS, duplicated here deliberately rather than imported: this test
// file should keep working even if that module's internal fixture shape changes,
// since it is testing THIS module's wiring, not re-testing the guards themselves.
const ALL_PASS_FACTS = {
  prHeadSha: "sha1",
  reviewedSha: "sha1",
  ciEvaluatedSha: "sha1",
  requiredCheckNames: [],
  actualChecks: [],
  unresolvedMustFixCount: 0,
  changedFiles: [],
  declaredPlanPaths: [],
  extraProtectedPatterns: [],
  unifiedDiff: "",
  baseCoverageThresholds: {},
  headCoverageThresholds: {},
  totalLinesChanged: 10,
  moduleBoundariesTouched: 1,
  riskTier: "L1",
  confidence: 0.9,
  reviewExpressedUncertainty: false,
  isReady: true,
  hasConflicts: false,
  isMergeable: true,
  defaultBranchHeadConclusion: "SUCCESS",
  prIncludesDefaultBranchHead: true,
  changedPaths: [],
  codeownersText: "",
  authorizedApprovers: [],
  issueAuthorHasWrite: true,
  commenterPermissions: [],
  currentBodyHash: "h1",
  snapshotBodyHash: "h1",
  acceptanceCriteriaCrowdDerived: false,
  routeReadSucceeded: true,
  route: {
    repos: { r: { type: "backend" } },
    dev_grants: [{ repos: ["r"], expires_on: "2099-01-01" }],
  },
  repoName: "r",
  now: new Date("2026-10-30"),
  principleRefIsAncestorOfDefaultBranch: true,
  defaultBranchSkillMdText: "SA-1",
  pauseFilePath: "/nonexistent/.dev-pause",
};

function happyPathDeps(overrides = {}) {
  return {
    commitAndPush: async () => {},
    openPr: async () => ({ prNumber: 100 }),
    pollChecks: async () => ({
      settled: true,
      checks: [{ name: "ci", conclusion: "SUCCESS" }],
    }),
    attemptCiFix: async () => {},
    gatherPromotionFacts: async () => ALL_PASS_FACTS,
    promote: async () => {},
    gatherPostPromotionFacts: async () => ALL_PASS_FACTS,
    merge: async () => {},
    readBack: async () => ({ merged: true, mergeCommit: "merged-sha" }),
    gatherCircuitBreakerFacts: async () => ({
      ciTurnedRedPostMerge: false,
      nonRunnerMergeDetected: false,
      twoConsecutiveBlockedIssues: false,
      repeatedToolErrors: false,
    }),
    gatherRollbackFacts: async () => ({
      defaultBranchCommitMessages: [],
      recordedMergeShas: [],
    }),
    ...overrides,
  };
}

test("runStep4 happy path: commits, opens, polls green, promotes, merges, reads back MERGED", async () => {
  const calls = [];
  const deps = happyPathDeps({
    commitAndPush: async () => calls.push("commitAndPush"),
    openPr: async () => {
      calls.push("openPr");
      return { prNumber: 100 };
    },
    promote: async () => calls.push("promote"),
    merge: async () => calls.push("merge"),
  });
  const result = await runStep4(
    { resumeState: {}, pauseFilePath: "/nonexistent/.dev-pause" },
    deps,
  );
  assert.equal(result.outcome, "MERGED");
  assert.equal(result.prNumber, 100);
  assert.equal(result.mergeCommit, "merged-sha");
  assert.deepEqual(calls, ["commitAndPush", "openPr", "promote", "merge"]);
});

test("runStep4 reports HUMAN_MERGE_REQUIRED when CI never turns green, and never calls promote or merge", async () => {
  let promoteCalled = false;
  let mergeCalled = false;
  const deps = happyPathDeps({
    pollChecks: async () => ({
      settled: true,
      checks: [{ name: "ci", conclusion: "FAILURE" }],
    }),
    promote: async () => {
      promoteCalled = true;
    },
    merge: async () => {
      mergeCalled = true;
    },
  });
  const result = await runStep4(
    { resumeState: {}, pauseFilePath: "/nonexistent/.dev-pause" },
    deps,
  );
  assert.equal(result.outcome, "HUMAN_MERGE_REQUIRED");
  assert.match(result.reason, /CI did not turn green/);
  assert.equal(promoteCalled, false);
  assert.equal(mergeCalled, false);
});

test("runStep4 reports HUMAN_MERGE_REQUIRED with guard failures when a pre-promotion guard fails, and never promotes", async () => {
  let promoteCalled = false;
  const deps = happyPathDeps({
    gatherPromotionFacts: async () => ({
      ...ALL_PASS_FACTS,
      totalLinesChanged: 9999,
    }),
    promote: async () => {
      promoteCalled = true;
    },
  });
  const result = await runStep4(
    { resumeState: {}, pauseFilePath: "/nonexistent/.dev-pause" },
    deps,
  );
  assert.equal(result.outcome, "HUMAN_MERGE_REQUIRED");
  assert.equal(result.failures[0].guard, "guardG5");
  assert.equal(promoteCalled, false);
});

test("runStep4 reports HUMAN_MERGE_REQUIRED when the post-promotion recheck fails, and never merges", async () => {
  let mergeCalled = false;
  const deps = happyPathDeps({
    gatherPostPromotionFacts: async () => ({
      ...ALL_PASS_FACTS,
      hasConflicts: true,
    }),
    merge: async () => {
      mergeCalled = true;
    },
  });
  const result = await runStep4(
    { resumeState: {}, pauseFilePath: "/nonexistent/.dev-pause" },
    deps,
  );
  assert.equal(result.outcome, "HUMAN_MERGE_REQUIRED");
  assert.equal(result.failures[0].guard, "guardG7");
  assert.equal(mergeCalled, false);
});

test("runStep4 reports FAILED when merge() runs but readback says not merged", async () => {
  const deps = happyPathDeps({
    readBack: async () => ({ merged: false, mergeCommit: null }),
  });
  const result = await runStep4(
    { resumeState: {}, pauseFilePath: "/nonexistent/.dev-pause" },
    deps,
  );
  assert.equal(result.outcome, "FAILED");
  assert.match(result.reason, /readback/);
});

test("runStep4 reports MERGED with circuitBreakerTripped:true and actually writes .dev-pause when the facts trip it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-and-merge-test-"));
  try {
    const pauseFilePath = join(dir, ".dev-pause");
    const deps = happyPathDeps({
      gatherCircuitBreakerFacts: async () => ({
        ciTurnedRedPostMerge: true,
        nonRunnerMergeDetected: false,
        twoConsecutiveBlockedIssues: false,
        repeatedToolErrors: false,
      }),
    });
    const result = await runStep4({ resumeState: {}, pauseFilePath }, deps);
    assert.equal(result.outcome, "MERGED");
    assert.equal(result.circuitBreakerTripped, true);
    assert.equal(existsSync(pauseFilePath), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runStep4 with resumeState.merged:true skips straight to readback, calling none of commitAndPush/openPr/promote/merge", async () => {
  const calls = [];
  const deps = happyPathDeps({
    commitAndPush: async () => calls.push("commitAndPush"),
    openPr: async () => {
      calls.push("openPr");
      return { prNumber: 999 };
    },
    promote: async () => calls.push("promote"),
    merge: async () => calls.push("merge"),
    readBack: async () => ({ merged: true, mergeCommit: "already-merged-sha" }),
  });
  const result = await runStep4(
    {
      resumeState: {
        openedPr: true,
        prNumber: 100,
        promotedToReady: true,
        merged: true,
      },
      pauseFilePath: "/nonexistent/.dev-pause",
    },
    deps,
  );
  assert.equal(result.outcome, "MERGED");
  assert.equal(result.prNumber, 100);
  assert.deepEqual(calls, []);
});

test("runStep4 with stopAfterCiGreen:true stops at PR_GREEN once CI is green, never calling promote or merge", async () => {
  let promoteCalled = false;
  let mergeCalled = false;
  const deps = happyPathDeps({
    promote: async () => {
      promoteCalled = true;
    },
    merge: async () => {
      mergeCalled = true;
    },
  });
  const result = await runStep4(
    {
      resumeState: {},
      pauseFilePath: "/nonexistent/.dev-pause",
      stopAfterCiGreen: true,
    },
    deps,
  );
  assert.equal(result.outcome, "PR_GREEN");
  assert.equal(result.prNumber, 100);
  assert.equal(promoteCalled, false);
  assert.equal(mergeCalled, false);
});

test("runStep4 with stopAfterCiGreen:true still reports HUMAN_MERGE_REQUIRED if CI never turns green", async () => {
  const deps = happyPathDeps({
    pollChecks: async () => ({
      settled: true,
      checks: [{ name: "ci", conclusion: "FAILURE" }],
    }),
  });
  const result = await runStep4(
    {
      resumeState: {},
      pauseFilePath: "/nonexistent/.dev-pause",
      stopAfterCiGreen: true,
    },
    deps,
  );
  assert.equal(result.outcome, "HUMAN_MERGE_REQUIRED");
});

test("runStep4 with stopAfterCiGreen:true but resumeState.merged:true (an earlier run already merged without --no-merge) still finishes through to MERGED, not PR_GREEN", async () => {
  const result = await runStep4(
    {
      resumeState: { openedPr: true, prNumber: 100, merged: true },
      pauseFilePath: "/nonexistent/.dev-pause",
      stopAfterCiGreen: true,
    },
    happyPathDeps(),
  );
  assert.equal(result.outcome, "MERGED");
});

test("runStep4 with resumeState.openedPr:true but not merged reuses the existing PR number instead of opening a new one", async () => {
  let openPrCalled = false;
  const deps = happyPathDeps({
    openPr: async () => {
      openPrCalled = true;
      return { prNumber: 999 };
    },
  });
  const result = await runStep4(
    {
      resumeState: { openedPr: true, prNumber: 100 },
      pauseFilePath: "/nonexistent/.dev-pause",
    },
    deps,
  );
  assert.equal(result.outcome, "MERGED");
  assert.equal(result.prNumber, 100);
  assert.equal(openPrCalled, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePostPromotionRecheck,
  evaluatePromotionReadiness,
  openDraftPr,
  pollChecks,
  promoteToReady,
  runCiRetryLoop,
} from "./pr-lifecycle.mjs";

// Every field any of G1-G11 destructures, set to a value that makes every guard
// pass. Each test below starts from a shallow copy and mutates exactly the field(s)
// relevant to the guard under test -- this is the shared "撤销/松动一个条件 -> 对应
// 用例变红" fixture, same technique used across engine/*.test.mjs.
const ALL_PASS_FACTS = {
  // G1
  prHeadSha: "sha1",
  reviewedSha: "sha1",
  ciEvaluatedSha: "sha1",
  // G2
  requiredCheckNames: ["test", "secret-scan"],
  actualChecks: [
    { name: "test", conclusion: "SUCCESS" },
    { name: "secret-scan", conclusion: "SUCCESS" },
  ],
  // G3
  unresolvedMustFixCount: 0,
  // G4
  changedFiles: [{ path: "engine/foo.mjs" }],
  declaredPlanPaths: ["engine/foo.mjs"],
  extraProtectedPatterns: [],
  unifiedDiff: "",
  baseCoverageThresholds: {},
  headCoverageThresholds: {},
  // G5
  totalLinesChanged: 10,
  moduleBoundariesTouched: 1,
  // G6
  riskTier: "L1",
  priorRiskTier: undefined,
  confidence: 0.9,
  reviewExpressedUncertainty: false,
  // G7
  isReady: true,
  hasConflicts: false,
  isMergeable: true,
  // G8
  defaultBranchHeadConclusion: "SUCCESS",
  prIncludesDefaultBranchHead: true,
  // G9
  changedPaths: ["engine/foo.mjs"],
  codeownersText: "",
  authorizedApprovers: [],
  // G10
  issueAuthorHasWrite: true,
  commenterPermissions: [],
  currentBodyHash: "h1",
  snapshotBodyHash: "h1",
  acceptanceCriteriaCrowdDerived: false,
  // G11
  routeReadSucceeded: true,
  route: {
    repos: { "test-repo": { type: "backend" } },
    dev_grants: [{ repos: ["test-repo"], expires_on: "2099-01-01" }],
  },
  repoName: "test-repo",
  now: new Date("2026-10-30"),
  principleRefIsAncestorOfDefaultBranch: true,
  defaultBranchSkillMdText: "clause SA-1 is in force",
  pauseFilePath: "/nonexistent-dir-xyz/.dev-pause",
};

test("evaluatePromotionReadiness passes when every pre-promotion guard's facts are clean", () => {
  const result = evaluatePromotionReadiness(ALL_PASS_FACTS);
  assert.deepEqual(result, { allPass: true, failures: [] });
});

test("evaluatePromotionReadiness surfaces exactly the one guard that fails", () => {
  const facts = { ...ALL_PASS_FACTS, totalLinesChanged: 500 };
  const result = evaluatePromotionReadiness(facts);
  assert.equal(result.allPass, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].guard, "guardG5");
});

test("evaluatePromotionReadiness does NOT evaluate G7 -- a draft PR's own not-ready/conflicted/unmergeable state does not block promotion by itself", () => {
  const facts = {
    ...ALL_PASS_FACTS,
    isReady: false,
    hasConflicts: true,
    isMergeable: false,
  };
  const result = evaluatePromotionReadiness(facts);
  assert.deepEqual(result, { allPass: true, failures: [] });
});

test("evaluatePostPromotionRecheck passes when its six guards' facts are clean", () => {
  const result = evaluatePostPromotionRecheck(ALL_PASS_FACTS);
  assert.deepEqual(result, { allPass: true, failures: [] });
});

test("evaluatePostPromotionRecheck does NOT re-evaluate G3/G4/G5/G6/G9 -- only G1,G2,G7,G8,G10,G11", () => {
  const facts = {
    ...ALL_PASS_FACTS,
    unresolvedMustFixCount: 99, // would fail G3
    totalLinesChanged: 9999, // would fail G5
    riskTier: "L3", // would fail G6
  };
  const result = evaluatePostPromotionRecheck(facts);
  assert.deepEqual(result, { allPass: true, failures: [] });
});

test("evaluatePostPromotionRecheck DOES catch a G7 regression (e.g. a conflict appearing right after promotion)", () => {
  const facts = { ...ALL_PASS_FACTS, hasConflicts: true };
  const result = evaluatePostPromotionRecheck(facts);
  assert.equal(result.allPass, false);
  assert.equal(result.failures[0].guard, "guardG7");
});

test("openDraftPr parses the PR number out of gh's printed URL and passes --draft", () => {
  let capturedArgs;
  const fakeExecGh = (args) => {
    capturedArgs = args;
    return "https://github.com/openIndu/control-tower/pull/99\n";
  };
  const result = openDraftPr(
    {
      repoPath: "openIndu/control-tower",
      title: "t",
      bodyFilePath: "/tmp/body.md",
      head: "feat/x",
    },
    fakeExecGh,
  );
  assert.equal(result.prNumber, 99);
  assert.ok(capturedArgs.includes("--draft"));
  assert.ok(capturedArgs.includes("feat/x"));
});

test("promoteToReady calls gh pr ready with the PR number and --repo", () => {
  let capturedArgs;
  promoteToReady(
    { repoPath: "openIndu/control-tower", prNumber: 42 },
    (args) => {
      capturedArgs = args;
    },
  );
  assert.deepEqual(capturedArgs, [
    "pr",
    "ready",
    "42",
    "--repo",
    "openIndu/control-tower",
  ]);
});

test("pollChecks returns immediately once fetchChecks reports every check settled, without sleeping", async () => {
  let sleepCalls = 0;
  const result = await pollChecks(
    { repoPath: "r", prNumber: 1 },
    {
      fetchChecks: async () => [
        { name: "ci", conclusion: "SUCCESS", settled: true },
      ],
      sleep: async () => {
        sleepCalls++;
      },
    },
  );
  assert.equal(result.settled, true);
  assert.equal(sleepCalls, 0);
});

test("pollChecks sleeps between polls while pending, then returns once settled", async () => {
  let call = 0;
  let sleepCalls = 0;
  const result = await pollChecks(
    { repoPath: "r", prNumber: 1, timeoutMs: 999999 },
    {
      fetchChecks: async () => {
        call++;
        return call < 3
          ? [{ name: "ci", conclusion: null, settled: false }]
          : [{ name: "ci", conclusion: "SUCCESS", settled: true }];
      },
      sleep: async () => {
        sleepCalls++;
      },
    },
  );
  assert.equal(result.settled, true);
  assert.equal(call, 3);
  assert.equal(sleepCalls, 2);
});

test("pollChecks gives up and reports timedOut once the deadline passes, without an infinite loop", async () => {
  let now = 0;
  const realDateNow = Date.now;
  Date.now = () => now;
  try {
    const result = await pollChecks(
      { repoPath: "r", prNumber: 1, timeoutMs: 100 },
      {
        fetchChecks: async () => [
          { name: "ci", conclusion: null, settled: false },
        ],
        sleep: async () => {
          now += 1000; // force the deadline to pass on the first sleep
        },
      },
    );
    assert.equal(result.settled, false);
    assert.equal(result.timedOut, true);
  } finally {
    Date.now = realDateNow;
  }
});

test("runCiRetryLoop returns green with 0 attempts when CI is already green", async () => {
  let fixCalls = 0;
  const result = await runCiRetryLoop({
    checkCi: async () => ({ green: true }),
    attemptFix: async () => {
      fixCalls++;
    },
  });
  assert.deepEqual(result, { outcome: "green", attempts: 0 });
  assert.equal(fixCalls, 0);
});

test("runCiRetryLoop fixes once and succeeds, stopping before a second attempt", async () => {
  let checkCalls = 0;
  const result = await runCiRetryLoop({
    checkCi: async () => {
      checkCalls++;
      return { green: checkCalls >= 2 };
    },
    attemptFix: async () => {},
  });
  assert.deepEqual(result, { outcome: "green", attempts: 1 });
});

test("runCiRetryLoop exhausts at maxAttempts (default 2) and reports exhausted, calling attemptFix exactly maxAttempts times", async () => {
  let fixCalls = 0;
  const result = await runCiRetryLoop({
    checkCi: async () => ({ green: false }),
    attemptFix: async () => {
      fixCalls++;
    },
  });
  assert.deepEqual(result, { outcome: "exhausted", attempts: 2 });
  assert.equal(fixCalls, 2);
});

import assert from "node:assert/strict";
import test from "node:test";

import { runIssuePipeline } from "./issue-pipeline.mjs";

const ISSUE = { number: 42, title: "Fix the thing", body: "it is broken" };

function liteScoping(overrides = {}) {
  return {
    summary: "x",
    estimatedLines: 10,
    moduleCount: 1,
    isDocsOrConfigOnly: true,
    touchesSensitiveArea: false,
    riskTier: "L0",
    declaredActionTypes: [],
    suggestedTier: null,
    confidence: 0.95,
    reviewerStatedUncertain: false,
    ...overrides,
  };
}

// happyPathStep4Deps duplicated here deliberately (same fixture style as
// pr-and-merge.test.mjs's own ALL_PASS_FACTS/happyPathDeps note) -- this file
// tests issue-pipeline.mjs's wiring, not pr-and-merge.mjs's guards.
function happyPathStep4Deps() {
  return {
    commitAndPush: async () => {},
    openPr: async () => ({ prNumber: 7 }),
    pollChecks: async () => ({
      settled: true,
      checks: [{ name: "ci", conclusion: "SUCCESS" }],
    }),
    attemptCiFix: async () => {},
    gatherPromotionFacts: async () => ({}),
    promote: async () => {},
    gatherPostPromotionFacts: async () => ({}),
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
  };
}

// guards-core/guards-g7-g11 need real facts to pass -- but this file is
// testing issue-pipeline's sequencing, not the guards, so stub
// evaluatePromotionReadiness/evaluatePostPromotionRecheck's inputs by making
// gatherPromotionFacts/gatherPostPromotionFacts return facts that pass. The
// simplest such facts are reused from pr-and-merge's own ALL_PASS_FACTS shape.
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

function happyDeps(overrides = {}) {
  return {
    createWorktree: () => {},
    generateScopingProposal: async () => liteScoping(),
    generateProposal: async () => ({ summary: "do the fix" }),
    reviewProposal: async () => ({ score: 9 }),
    implement: async () => {},
    reviewImplementation: async () => ({ mustFixItems: [] }),
    fix: async () => {},
    execShell: () => ({ status: 0, output: "ok" }),
    buildStep4Deps: () => ({
      ...happyPathStep4Deps(),
      gatherPromotionFacts: async () => ALL_PASS_FACTS,
      gatherPostPromotionFacts: async () => ALL_PASS_FACTS,
    }),
    ...overrides,
  };
}

function baseContext(overrides = {}) {
  return {
    repoClonePath: "/clone",
    worktreeBaseDir: "/tmp/wt-base",
    runId: "run-1",
    baseRef: "origin/main",
    devChecks: ["npm test"],
    resumeIssueState: {},
    pauseFilePath: "/nonexistent/.dev-pause",
    ...overrides,
  };
}

test("runIssuePipeline happy path: creates the worktree, resolves tier, runs step 2/3/4, returns MERGED with both documents", async () => {
  let worktreeArgs = null;
  const gateCwds = [];
  const result = await runIssuePipeline(
    ISSUE,
    baseContext(),
    happyDeps({
      createWorktree: (args) => {
        worktreeArgs = args;
      },
      execShell: (command, cwd) => {
        gateCwds.push(cwd);
        return { status: 0, output: "ok" };
      },
    }),
  );
  assert.equal(result.state, "MERGED");
  assert.equal(result.tier, "lite");
  assert.equal(result.prNumber, 7);
  assert.ok(result.solutionDocument);
  assert.ok(result.implementationReviewDocument);
  assert.equal(worktreeArgs.repoPath, "/clone");
  assert.equal(worktreeArgs.branchName, "dev/issue-42");
  assert.match(worktreeArgs.worktreePath, /run-1[\\/]issue-42$/);
  // devChecks (route.json's dev.checks) must run as a local gate inside the
  // issue's own worktree, not the runner process's cwd -- this is the exact
  // gap found via this test before execShell/cwd threading was added.
  assert.equal(gateCwds.length, 1);
  assert.equal(gateCwds[0], worktreeArgs.worktreePath);
});

test("runIssuePipeline reports HUMAN_REQUIRED from tier resolution and never runs step 2/3/4", async () => {
  let step4DepsBuilt = false;
  const result = await runIssuePipeline(
    ISSUE,
    baseContext(),
    happyDeps({
      generateScopingProposal: async () => liteScoping({ confidence: 0.2 }),
      generateProposal: async () => {
        throw new Error("step 2 must not run");
      },
      buildStep4Deps: () => {
        step4DepsBuilt = true;
        return happyPathStep4Deps();
      },
    }),
  );
  assert.equal(result.state, "HUMAN_REQUIRED");
  assert.equal(step4DepsBuilt, false);
});

test("runIssuePipeline reports BLOCKED when step 3 exhausts its review/fix rounds, and never runs step 4", async () => {
  let step4DepsBuilt = false;
  const result = await runIssuePipeline(
    ISSUE,
    baseContext(),
    happyDeps({
      reviewImplementation: async () => ({ mustFixItems: ["still broken"] }),
      buildStep4Deps: () => {
        step4DepsBuilt = true;
        return happyPathStep4Deps();
      },
    }),
  );
  assert.equal(result.state, "BLOCKED");
  assert.equal(step4DepsBuilt, false);
});

test("runIssuePipeline on resume with openedPr:true skips the worktree, tier resolution, and steps 2/3 entirely, going straight to step 4", async () => {
  let worktreeCreated = false;
  let scopingCalled = false;
  let proposalCalled = false;
  const result = await runIssuePipeline(
    ISSUE,
    baseContext({
      resumeIssueState: { openedPr: true, prNumber: 7, merged: false },
    }),
    happyDeps({
      createWorktree: () => {
        worktreeCreated = true;
      },
      generateScopingProposal: async () => {
        scopingCalled = true;
        return liteScoping();
      },
      generateProposal: async () => {
        proposalCalled = true;
        return { summary: "x" };
      },
    }),
  );
  assert.equal(result.state, "MERGED");
  assert.equal(result.prNumber, 7);
  assert.equal(worktreeCreated, false);
  assert.equal(scopingCalled, false);
  assert.equal(proposalCalled, false);
  assert.equal(result.tier, null);
});

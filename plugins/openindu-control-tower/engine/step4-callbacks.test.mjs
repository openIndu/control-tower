import assert from "node:assert/strict";
import test from "node:test";

import { buildStep4Callbacks } from "./step4-callbacks.mjs";

function baseContext(overrides = {}) {
  return {
    org: "openIndu",
    repo: "backend",
    worktreePath: "/wt",
    branchName: "dev/issue-9",
    prTitle: "fix: thing",
    prBodyFilePath: "/wt/pr-body.md",
    baseRef: "origin/main",
    defaultBranch: "main",
    commit: { subject: "fix: thing", coAuthoredBy: null, signoff: false },
    carrier: {
      systemPromptFilePath: "/wt/sp.txt",
      promptDir: "/tmp/prompts",
      allowedToolCommands: ["npm test"],
      maxBudgetUsd: 5,
    },
    controlTowerRepoPath: "/ct",
    controlTowerRef: "main",
    grantPrincipleRef: "principle-sha",
    issue: { number: 9, title: "t", body: "b" },
    ...overrides,
  };
}

function fakeDeps(overrides = {}) {
  return {
    openPrFn: () => ({ url: "https://x/pull/9", prNumber: 9 }),
    pollChecksFn: () => ({ settled: true, checks: [] }),
    promoteFn: () => {},
    mergeFn: () => {},
    readBackFn: () => ({ merged: true, mergeCommit: "abc" }),
    stageFn: () => {},
    commitFn: () => {},
    pushFn: () => {},
    fetchPrSnapshot: () => ({
      prHeadSha: "head-sha",
      actualChecks: [
        { name: "unit-tests", conclusion: "FAILURE" },
        { name: "lint", conclusion: "SUCCESS" },
      ],
    }),
    fetchDefaultBranchHeadConclusion: () => "SUCCESS",
    fetchPrMergedBy: () => "the-runner-bot",
    fetchRunnerLogin: () => "the-runner-bot",
    fetchDefaultBranchCommitMessages: () => ["feat: a", "fix: b"],
    buildFix: () => async () => {},
    gatherFacts: async () => ({ ok: true }),
    ...overrides,
  };
}

test("commitAndPush stages, commits with the built message, and pushes the branch", async () => {
  let seen = {};
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      stageFn: (worktreePath) => {
        seen.staged = worktreePath;
      },
      commitFn: (args) => {
        seen.commit = args;
      },
      pushFn: (args) => {
        seen.push = args;
      },
    }),
  );
  await callbacks.commitAndPush();
  assert.equal(seen.staged, "/wt");
  assert.equal(seen.commit.worktreePath, "/wt");
  assert.equal(seen.commit.message, "fix: thing");
  assert.equal(seen.push.branchName, "dev/issue-9");
});

test("openPr opens a draft PR with the right repoPath/head/base and returns the discovered PR number", async () => {
  let seen = null;
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      openPrFn: (args) => {
        seen = args;
        return { url: "https://x/pull/42", prNumber: 42 };
      },
    }),
  );
  const result = await callbacks.openPr();
  assert.deepEqual(result, { prNumber: 42 });
  assert.equal(seen.repoPath, "openIndu/backend");
  assert.equal(seen.head, "dev/issue-9");
  assert.equal(seen.base, "origin/main");
});

test("pollChecks adapts to pr-lifecycle.mjs's {repoPath, prNumber} shape", async () => {
  let seen = null;
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      pollChecksFn: (args) => ((seen = args), { settled: true, checks: [] }),
    }),
  );
  await callbacks.pollChecks(9);
  assert.deepEqual(seen, { repoPath: "openIndu/backend", prNumber: 9 });
});

test("attemptCiFix passes only the non-SUCCESS checks to fix, alongside the attempt number and the issue", async () => {
  let seenFixArgs = null;
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      buildFix: () => async (failureDescription, issue) => {
        seenFixArgs = { failureDescription, issue };
      },
    }),
  );
  await callbacks.openPr();
  await callbacks.attemptCiFix(2);
  assert.equal(seenFixArgs.failureDescription.reason, "ci-failure");
  assert.equal(seenFixArgs.failureDescription.attempt, 2);
  assert.deepEqual(seenFixArgs.failureDescription.failingChecks, [
    { name: "unit-tests", conclusion: "FAILURE" },
  ]);
  assert.equal(seenFixArgs.issue.number, 9);
});

test("promote adapts to promoteToReady's {repoPath, prNumber} shape", async () => {
  let seen = null;
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({ promoteFn: (args) => (seen = args) }),
  );
  await callbacks.promote(9);
  assert.deepEqual(seen, { repoPath: "openIndu/backend", prNumber: 9 });
});

test("merge fetches the PR's current head SHA fresh and passes it to executeMerge", async () => {
  let seen = null;
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      fetchPrSnapshot: () => ({
        prHeadSha: "fresh-head-sha",
        actualChecks: [],
      }),
      mergeFn: (args) => (seen = args),
    }),
  );
  await callbacks.merge(9);
  assert.deepEqual(seen, {
    repoPath: "openIndu/backend",
    prNumber: 9,
    headSha: "fresh-head-sha",
  });
});

test("readBack adapts to readBackMergeState's {repoPath, prNumber} shape", async () => {
  let seen = null;
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      readBackFn: (args) => ((seen = args), { merged: true, mergeCommit: "m" }),
    }),
  );
  const result = await callbacks.readBack(9);
  assert.deepEqual(seen, { repoPath: "openIndu/backend", prNumber: 9 });
  assert.deepEqual(result, { merged: true, mergeCommit: "m" });
});

test("gatherCircuitBreakerFacts flags ciTurnedRedPostMerge when the default branch head is not SUCCESS, and passes through the run-history facts", async () => {
  const callbacks = buildStep4Callbacks(
    baseContext(),
    { twoConsecutiveBlockedIssues: true, repeatedToolErrors: false },
    fakeDeps({ fetchDefaultBranchHeadConclusion: () => "FAILURE" }),
  );
  const facts = await callbacks.gatherCircuitBreakerFacts();
  assert.equal(facts.ciTurnedRedPostMerge, true);
  assert.equal(facts.twoConsecutiveBlockedIssues, true);
  assert.equal(facts.repeatedToolErrors, false);
});

test("gatherCircuitBreakerFacts detects a non-runner merge by comparing mergedBy against the runner's own login, only once a PR has actually been opened", async () => {
  const callbacksNoPr = buildStep4Callbacks(baseContext(), {}, fakeDeps());
  const factsNoPr = await callbacksNoPr.gatherCircuitBreakerFacts();
  assert.equal(factsNoPr.nonRunnerMergeDetected, false);

  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      fetchPrMergedBy: () => "someone-else",
      fetchRunnerLogin: () => "the-runner-bot",
    }),
  );
  await callbacks.openPr();
  const facts = await callbacks.gatherCircuitBreakerFacts();
  assert.equal(facts.nonRunnerMergeDetected, true);
});

test("gatherCircuitBreakerFacts does not flag a non-runner merge when mergedBy matches the runner's own login", async () => {
  const callbacks = buildStep4Callbacks(
    baseContext(),
    {},
    fakeDeps({
      fetchPrMergedBy: () => "the-runner-bot",
      fetchRunnerLogin: () => "the-runner-bot",
    }),
  );
  await callbacks.openPr();
  const facts = await callbacks.gatherCircuitBreakerFacts();
  assert.equal(facts.nonRunnerMergeDetected, false);
});

test("gatherRollbackFacts reads default-branch commit messages fresh and passes through recordedMergeShas", async () => {
  const callbacks = buildStep4Callbacks(
    baseContext(),
    { recordedMergeShas: ["sha1", "sha2"] },
    fakeDeps({
      fetchDefaultBranchCommitMessages: () => ["feat: x", "revert: y"],
    }),
  );
  const facts = await callbacks.gatherRollbackFacts();
  assert.deepEqual(facts.defaultBranchCommitMessages, ["feat: x", "revert: y"]);
  assert.deepEqual(facts.recordedMergeShas, ["sha1", "sha2"]);
});

test("gatherPromotionFacts and gatherPostPromotionFacts both delegate to gatherMergeFacts with the same context", async () => {
  let callCount = 0;
  const callbacks = buildStep4Callbacks(
    baseContext(),
    { reviewedSha: "head-sha" },
    fakeDeps({
      gatherFacts: async (ctx, internal) => {
        callCount += 1;
        return { ctx, internal };
      },
    }),
  );
  const a = await callbacks.gatherPromotionFacts(9);
  const b = await callbacks.gatherPostPromotionFacts(9);
  assert.equal(callCount, 2);
  assert.equal(a.ctx.prNumber, 9);
  assert.equal(b.ctx.prNumber, 9);
  assert.equal(a.internal.reviewedSha, "head-sha");
});

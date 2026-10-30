import { execFileSync } from "node:child_process";

import { buildRealFix } from "./carrier-callbacks.mjs";
import {
  buildCommitMessage,
  commitChanges,
  pushBranch,
  stageAllChanges,
} from "./git-ops.mjs";
import {
  defaultFetchDefaultBranchHeadConclusion,
  defaultFetchPrSnapshot,
  gatherMergeFacts,
} from "./merge-facts.mjs";
import { executeMerge, readBackMergeState } from "./merge-execute.mjs";
import { openDraftPr, pollChecks, promoteToReady } from "./pr-lifecycle.mjs";

// Builds the exact callback object pr-and-merge.mjs's runStep4 (F5, #41) needs,
// by adapting already-real functions from stage 6 (pr-lifecycle.mjs's
// openDraftPr/pollChecks/promoteToReady, merge-execute.mjs's
// executeMerge/readBackMergeState, git-ops.mjs's commit/push) and F8-4's
// gatherMergeFacts to runStep4's argument shapes. This module adds exactly one
// new real action -- attemptCiFix, reusing F8-5's buildRealFix -- plus the
// fresh-read half of the circuit-breaker/rollback facts; the run-history half
// (twoConsecutiveBlockedIssues, repeatedToolErrors, recordedMergeShas) is
// orchestration-level state only the caller's run-state tracking holds, passed
// through as internalFacts, same "gather what's fresh, caller supplies what's
// internal" split as gatherMergeFacts itself.

function defaultExecGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function ghApiJson(endpoint, jqFilter) {
  const args = ["api", endpoint];
  if (jqFilter) args.push("--jq", jqFilter);
  const raw = execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return jqFilter ? raw.trim() : JSON.parse(raw);
}

export function defaultFetchPrMergedBy(org, repo, prNumber) {
  return ghApiJson(
    `repos/${org}/${repo}/pulls/${prNumber}`,
    '.merged_by.login // ""',
  );
}

export function defaultFetchRunnerLogin() {
  return ghApiJson("user", ".login");
}

// branch is a bare name (e.g. "main"); the worktree's local git history needs
// "origin/<branch>" (worktree.mjs's own default baseRef convention), not a gh
// API call, which is why this differs from merge-facts.mjs's gh-based
// default-branch reads. A fresh `git fetch` runs first -- the worktree may
// have been created well before step 4 runs, so its origin/<branch> ref could
// otherwise miss a very recent revert, defeating the one thing this fact
// exists to catch.
export function defaultFetchDefaultBranchCommitMessages(
  repoPath,
  branch,
  limit = 50,
) {
  const execGit = defaultExecGit;
  execGit(["fetch", "origin", branch], repoPath);
  const out = execGit(
    ["log", `origin/${branch}`, "-n", String(limit), "--format=%s"],
    repoPath,
  );
  return out.split("\n").filter(Boolean);
}

// context: { org, repo, worktreePath, branchName, prTitle, prBodyFilePath,
// baseRef, defaultBranch, commit: {subject, body, coAuthoredBy, signoff},
// carrier: {systemPromptFilePath, promptDir, allowedToolCommands,
// maxBudgetUsd}, controlTowerRepoPath, controlTowerRef, grantPrincipleRef,
// resumePrNumber }. internalFacts: everything gatherMergeFacts' own
// internalFacts parameter needs (reviewedSha, unresolvedMustFixCount, etc, see
// merge-facts.mjs), plus twoConsecutiveBlockedIssues, repeatedToolErrors,
// recordedMergeShas for the circuit-breaker/rollback facts.
export function buildStep4Callbacks(
  context,
  internalFacts = {},
  {
    openPrFn = openDraftPr,
    pollChecksFn = pollChecks,
    promoteFn = promoteToReady,
    mergeFn = executeMerge,
    readBackFn = readBackMergeState,
    stageFn = stageAllChanges,
    commitFn = commitChanges,
    pushFn = pushBranch,
    fetchPrSnapshot = defaultFetchPrSnapshot,
    fetchDefaultBranchHeadConclusion = defaultFetchDefaultBranchHeadConclusion,
    fetchPrMergedBy = defaultFetchPrMergedBy,
    fetchRunnerLogin = defaultFetchRunnerLogin,
    fetchDefaultBranchCommitMessages = defaultFetchDefaultBranchCommitMessages,
    buildFix = buildRealFix,
    gatherFacts = gatherMergeFacts,
  } = {},
) {
  const {
    org,
    repo,
    worktreePath,
    branchName,
    prTitle,
    prBodyFilePath,
    baseRef,
    defaultBranch,
    commit,
    carrier,
    controlTowerRepoPath,
    controlTowerRef,
    grantPrincipleRef,
    resumePrNumber,
    issue,
  } = context;
  const repoPath = `${org}/${repo}`;
  let currentPrNumber = resumePrNumber ?? null;

  async function commitAndPush() {
    stageFn(worktreePath);
    commitFn({
      worktreePath,
      message: buildCommitMessage(commit),
      signoff: commit.signoff,
    });
    pushFn({ worktreePath, branchName });
  }

  async function openPr() {
    const { prNumber } = openPrFn({
      repoPath,
      title: prTitle,
      bodyFilePath: prBodyFilePath,
      head: branchName,
      base: baseRef ?? defaultBranch,
    });
    currentPrNumber = prNumber;
    return { prNumber };
  }

  async function pollChecksAdapter(prNumber) {
    return pollChecksFn({ repoPath, prNumber });
  }

  const fix = buildFix({
    worktreePath,
    systemPromptFilePath: carrier.systemPromptFilePath,
    promptDir: carrier.promptDir,
    allowedToolCommands: carrier.allowedToolCommands,
    maxBudgetUsd: carrier.maxBudgetUsd,
  });

  async function attemptCiFix(attempt) {
    const { actualChecks } = fetchPrSnapshot(org, repo, currentPrNumber);
    const failingChecks = actualChecks.filter(
      (c) => c.conclusion !== "SUCCESS",
    );
    await fix({ reason: "ci-failure", attempt, failingChecks }, issue);
  }

  function gatherFactsFor(prNumber) {
    return gatherFacts(
      {
        org,
        repo,
        prNumber,
        repoWorktreePath: worktreePath,
        baseRef,
        defaultBranch,
        controlTowerRepoPath,
        controlTowerRef,
        grantPrincipleRef,
      },
      internalFacts,
    );
  }

  async function promote(prNumber) {
    promoteFn({ repoPath, prNumber });
  }

  async function merge(prNumber) {
    const { prHeadSha } = fetchPrSnapshot(org, repo, prNumber);
    mergeFn({ repoPath, prNumber, headSha: prHeadSha });
  }

  async function readBack(prNumber) {
    return readBackFn({ repoPath, prNumber });
  }

  async function gatherCircuitBreakerFacts() {
    const conclusion = fetchDefaultBranchHeadConclusion(
      org,
      repo,
      defaultBranch,
    );
    const mergedBy = currentPrNumber
      ? fetchPrMergedBy(org, repo, currentPrNumber)
      : "";
    const runnerLogin = currentPrNumber ? fetchRunnerLogin() : "";
    return {
      ciTurnedRedPostMerge: conclusion !== "SUCCESS",
      // Scope note: this only checks whether the PR this run just merged was
      // actually merged by the runner's own gh identity, not a broader scan of
      // every merge on the default branch -- a stated interpretation of "a
      // non-runner merge was detected", not the only possible one.
      nonRunnerMergeDetected: currentPrNumber
        ? mergedBy !== runnerLogin
        : false,
      twoConsecutiveBlockedIssues:
        internalFacts.twoConsecutiveBlockedIssues ?? false,
      repeatedToolErrors: internalFacts.repeatedToolErrors ?? false,
    };
  }

  async function gatherRollbackFacts() {
    return {
      defaultBranchCommitMessages: fetchDefaultBranchCommitMessages(
        worktreePath,
        defaultBranch,
      ),
      recordedMergeShas: internalFacts.recordedMergeShas ?? [],
    };
  }

  return {
    commitAndPush,
    openPr,
    pollChecks: pollChecksAdapter,
    attemptCiFix,
    gatherPromotionFacts: gatherFactsFor,
    promote,
    gatherPostPromotionFacts: gatherFactsFor,
    merge,
    readBack,
    gatherCircuitBreakerFacts,
    gatherRollbackFacts,
  };
}

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { currentCommitSha } from "./git-ops.mjs";
import { computeBodyHash } from "./guards-g7-g11.mjs";
import { defaultComputePatchId } from "./merge-facts.mjs";
import { renderPrBody, renderPrTitle } from "./pr-content.mjs";
import { buildStep4Callbacks } from "./step4-callbacks.mjs";

function defaultFetchCurrentIssueBody(org, repo, issueNumber) {
  const raw = execFileSync(
    "gh",
    [
      "issue",
      "view",
      String(issueNumber),
      "--repo",
      `${org}/${repo}`,
      "--json",
      "body",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(raw).body ?? "";
}

function writeTextFile(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

// Assembles the context + internalFacts step4-callbacks.mjs's
// buildStep4Callbacks needs, from issue-pipeline.mjs's per-issue call shape
// plus repo/run-level context only the caller's main() loop knows, then
// calls it -- this module adds no new orchestration, it is purely an
// adapter, same relationship buildStep4Callbacks itself has to runStep4.
//
// runContext: { org, repo, baseRef, defaultBranch, docsDir, carrier:
// {systemPromptFilePath, promptDir, allowedToolCommands, maxBudgetUsd},
// controlTowerRepoPath, controlTowerRef, grantPrincipleRef, resumePrNumber,
// commit: {coAuthoredBy, signoff} (route.json's dev.commit.*),
// publishesOnMerge (route.json's dev.publishes_on_merge), authorizedApprovers
// (resolved ONCE per repo via authorized-approvers.mjs's
// listAuthorizedApprovers, reused across every issue in the repo -- re-
// resolving per issue would be a wasted gh call for data that cannot change
// within one run), recordedMergeShas/twoConsecutiveBlockedIssues/
// repeatedToolErrors (run-state-tracked, caller-owned, same split
// step4-callbacks.mjs's own circuit-breaker facts already use). }.
//
// issueArgs: exactly what issue-pipeline.mjs's runIssuePipeline passes to its
// injected buildStep4Deps: { worktreePath, branchName, issue, tier, scoping,
// declaredPaths, solutionDocument, implementationReviewDocument }. issue, in
// a real run, is already a snapshot entry (issue-intake.mjs's
// buildSnapshotEntry spreads the raw issue's own fields onto
// {bodyHashAtSnapshot, source}), so G10's facts are read directly off it
// here -- issue-pipeline.mjs itself needs no further changes to carry them.
//
// G1's reviewedSha/reviewedPatchId are captured lazily, memoized on first
// read, not computed eagerly here: at buildRealStep4Deps-construction time
// no step-4 commit has happened yet (step 3's implement/review/fix only
// edit files -- confirmed by reading carrier-callbacks.mjs's own prompts
// directly), so an eager read would just be the worktree's pre-
// implementation base commit. By the time anything actually reads
// internalFacts (gatherPromotionFacts, always called after commitAndPush
// has run, per pr-and-merge.mjs's own sequencing), the real post-
// implementation commit exists, and lazy-on-first-access plus memoization
// keeps it fixed at that one commit even across a later CI-fix round's
// re-commit (PR-#59) -- "the commit that was reviewed" must not drift just
// because CI needed another attempt.
//
// ciEvaluatedSha is deliberately left unsupplied: guardG1's exact-match fast
// path wants it, but gatherMergeFacts's own freshly-read prHeadSha is --  by
// construction, since promotion facts are only ever gathered right after
// runCiRetryLoop confirms green on the then-current head -- always equal to
// it anyway, and the patch-id-equivalence branch (which this module DOES
// correctly source via reviewedPatchId/currentPatchId, the latter already
// gathered fresh by gatherMergeFacts itself) does not reference
// ciEvaluatedSha at all. ciRanOnCurrentHead is therefore always true here,
// for the same construction reason, not a guess.
//
// currentBodyHash is a getter, re-fetched fresh every time it's read (unlike
// reviewedSha, deliberately NOT memoized): G10's whole purpose is catching a
// LATE edit to the issue body, right up to merge time, so a value cached at
// construction time would defeat the check it exists to run.
export function buildRealStep4Deps(runContext, issueArgs, overrides = {}) {
  const {
    org,
    repo,
    baseRef,
    defaultBranch,
    docsDir,
    carrier,
    controlTowerRepoPath,
    controlTowerRef,
    grantPrincipleRef,
    resumePrNumber,
    commit: commitConfig = {},
    publishesOnMerge = false,
    authorizedApprovers = [],
    recordedMergeShas = [],
    twoConsecutiveBlockedIssues = false,
    repeatedToolErrors = false,
  } = runContext;
  const {
    worktreePath,
    branchName,
    issue,
    tier,
    scoping,
    declaredPaths,
    solutionDocument,
    implementationReviewDocument,
  } = issueArgs;
  const {
    fetchCurrentIssueBody = defaultFetchCurrentIssueBody,
    computePatchId = defaultComputePatchId,
    getCommitSha = currentCommitSha,
    now = () => new Date(),
    step4CallbacksOverrides = {},
  } = overrides;

  const prTitle = renderPrTitle(issue);
  const prBodyFilePath = writeTextFile(
    join(docsDir, `issue-${issue.number}-pr-body.md`),
    renderPrBody({
      issue,
      repo,
      branchName,
      solutionDocument,
      implementationReviewDocument,
      publishesOnMerge,
    }),
  );

  let reviewedCache = null;
  function getReviewed() {
    if (reviewedCache === null) {
      const sha = getCommitSha(worktreePath);
      reviewedCache = {
        sha,
        patchId: computePatchId(worktreePath, baseRef, sha),
      };
    }
    return reviewedCache;
  }

  const internalFacts = {
    get reviewedSha() {
      return getReviewed().sha;
    },
    get reviewedPatchId() {
      return getReviewed().patchId;
    },
    ciRanOnCurrentHead: true,
    // step3Result.outcome === "BLOCKED" short-circuits issue-pipeline.mjs
    // before buildStep4Deps is ever called -- any unresolved must-fix item
    // reaching this point would be a caller bug, not a real possibility.
    unresolvedMustFixCount: 0,
    declaredPlanPaths: declaredPaths ?? [],
    riskTier: tier,
    priorRiskTier: tier,
    confidence: scoping?.confidence ?? null,
    reviewExpressedUncertainty: scoping?.reviewerStatedUncertain ?? false,
    acceptanceCriteriaCrowdDerived:
      scoping?.acceptanceCriteriaCrowdDerived ?? false,
    authorizedApprovers,
    issueAuthorHasWrite: issue.source?.issueAuthorHasWrite ?? false,
    commenterPermissions: issue.source?.commenterPermissions ?? [],
    snapshotBodyHash: issue.bodyHashAtSnapshot ?? null,
    get currentBodyHash() {
      return computeBodyHash(fetchCurrentIssueBody(org, repo, issue.number));
    },
    repoName: repo,
    get now() {
      return now();
    },
    twoConsecutiveBlockedIssues,
    repeatedToolErrors,
    recordedMergeShas,
  };

  return buildStep4Callbacks(
    {
      org,
      repo,
      worktreePath,
      branchName,
      prTitle,
      prBodyFilePath,
      baseRef,
      defaultBranch,
      commit: {
        subject: prTitle,
        coAuthoredBy: commitConfig.coAuthoredBy ?? null,
        signoff: commitConfig.signoff ?? false,
      },
      carrier,
      controlTowerRepoPath,
      controlTowerRef,
      grantPrincipleRef,
      resumePrNumber,
      issue,
    },
    internalFacts,
    step4CallbacksOverrides,
  );
}

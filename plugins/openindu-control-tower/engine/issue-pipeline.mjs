import { runStep3 } from "./implement-review.mjs";
import { runStep4 } from "./pr-and-merge.mjs";
import { runStep2 } from "./proposal-review.mjs";
import { resolveTier } from "./tier-resolution.mjs";
import {
  createIssueWorktree,
  issueBranchName,
  issueWorktreePath,
} from "./worktree.mjs";

// The complete per-issue pipeline for /dev's main loop: worktree -> tier
// resolution -> step 2 (propose+review+solidify) -> step 3 (implement+review+
// fix) -> step 4 (commit/PR/CI/merge). Ties together F3/F4/F5's already-built
// step orchestrators and F8-3's resolveTier -- no step logic is duplicated
// here, this module only sequences them and decides what to skip on --resume.
//
// run-state.mjs's issue-state shape ({openedPr, prNumber, promotedToReady,
// merged, ...}) only tracks step 4's progress -- it has no "step 2/3 done"
// flag, because once a PR is open the implementation is already committed and
// pushed. So resumeIssueState.openedPr is the single switch this module uses
// to decide whether to redo tier/step2/step3 at all: redoing them on resume
// would re-invoke agents pointlessly (wasting budget) and would try to
// `git worktree add` a path that already exists from the earlier run.
//
// stopAfterStep2 (spec/005 section 2.1's --dry-run) returns right after step
// 2 produces its solution document, before step 3/4 ever run -- see the
// return site below for why that result has no `state` field.

export async function runIssuePipeline(
  issue,
  {
    repoClonePath,
    worktreeBaseDir,
    runId,
    baseRef,
    devChecks = [],
    resumeIssueState = {},
    pauseFilePath,
    stopAfterCiGreen = false,
    stopAfterStep2 = false,
  },
  {
    createWorktree = createIssueWorktree,
    generateScopingProposal,
    generateProposal,
    reviewProposal,
    implement,
    reviewImplementation,
    fix,
    execShell,
    buildStep4Deps,
  },
) {
  const worktreePath = issueWorktreePath({
    baseDir: worktreeBaseDir,
    runId,
    issueNumber: issue.number,
  });
  const branchName = issueBranchName(issue.number);

  let tier = null;
  let scoping = null;
  let step2Result = null;
  let step3Result = null;

  if (!resumeIssueState.openedPr) {
    createWorktree({
      repoPath: repoClonePath,
      worktreePath,
      branchName,
      baseRef,
    });

    const tierResult = await resolveTier(issue, generateScopingProposal);
    scoping = tierResult.scoping;
    if (tierResult.outcome === "HUMAN_REQUIRED") {
      return {
        state: "HUMAN_REQUIRED",
        reason: tierResult.reason,
        worktreePath,
        branchName,
      };
    }
    tier = tierResult.tier;

    step2Result = await runStep2(
      { issue, tier },
      { generateProposal, reviewProposal },
    );

    // spec/005 section 2.1: "--dry-run（做到步骤 2 为止，对 GitHub 零写入）" --
    // the worktree above is still created (step 2's carrier calls run with
    // it as their cwd, so they can read real repo content; see
    // carrier-callbacks.mjs's buildRealGenerateProposal), but nothing past
    // this point ever touches git add/commit/push or the GitHub API, so
    // stopping here is a real zero-GitHub-writes guarantee, not just a
    // convention. No `state` field on this result on purpose -- it is not
    // one of states.mjs's TERMINAL_STATES (that enum is dev.schema.json's
    // documented, closed contract for the real pipeline's outcomes; a dry
    // run stopping by design is a different kind of result, not a new
    // member of that set), so a caller that forgets this branch and feeds
    // it to exitCodeForStates fails loudly instead of being silently
    // miscounted as some unrelated terminal state.
    if (stopAfterStep2) {
      return {
        dryRun: true,
        worktreePath,
        branchName,
        tier,
        solutionDocument: step2Result.document,
      };
    }

    step3Result = await runStep3(
      {
        issue,
        tier,
        winningProposal: step2Result.winner,
        localGateCommands: devChecks,
        worktreePath,
      },
      { implement, review: reviewImplementation, fix, execShell },
    );
    if (step3Result.outcome === "BLOCKED") {
      return {
        state: "BLOCKED",
        reason: "implementation review exhausted its rounds",
        document: step3Result.document,
        worktreePath,
        branchName,
        tier,
      };
    }
  }

  // pr-content.mjs's renderPrBody needs the documents to write a real PR
  // body; guardG4/guardG6 need declaredPaths/scoping -- on resume
  // (step2Result/step3Result/scoping still null here) there is nothing to
  // pass. openPr()/gatherPromotionFacts() (which is where G4/G6 actually
  // run, via PRE_PROMOTION_GUARDS) are skipped when resumeIssueState already
  // has openedPr/promotedToReady true. gatherPostPromotionFacts DOES still
  // run unconditionally, but pr-lifecycle.mjs's POST_PROMOTION_GUARDS
  // deliberately excludes G4/G6 ("转 ready 后...不能倒退改声明范围或风险档
  // 位" -- confirmed by reading that guard list directly), so a null value
  // here never actually reaches a guard that reads it, on any resume path.
  const step4Deps = buildStep4Deps({
    worktreePath,
    branchName,
    issue,
    tier,
    scoping,
    declaredPaths: step2Result?.winner?.declaredPaths ?? null,
    solutionDocument: step2Result?.document ?? null,
    implementationReviewDocument: step3Result?.document ?? null,
  });
  const step4Result = await runStep4(
    { resumeState: resumeIssueState, pauseFilePath, stopAfterCiGreen },
    step4Deps,
  );

  return {
    state: step4Result.outcome,
    worktreePath,
    branchName,
    tier,
    solutionDocument: step2Result?.document ?? null,
    implementationReviewDocument: step3Result?.document ?? null,
    ...step4Result,
  };
}

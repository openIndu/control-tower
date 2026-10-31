import { listAuthorizedApprovers } from "./authorized-approvers.mjs";

// Resolves the parts of buildRealStep4Deps's runContext that are fixed for
// an entire repo run -- authorizedApprovers, commit config, and
// publishesOnMerge cannot change within a single run, so this is called
// ONCE per repo, not once per issue (re-resolving authorizedApprovers per
// issue would just be a wasted gh call for data that is already fixed).
//
// resumePrNumber is deliberately NOT included here -- unlike every other
// field on this object, it varies per issue (run-state.mjs's own per-issue
// prNumber on --resume), so the caller's per-issue loop must set it fresh
// on each buildRealStep4Deps call (e.g. {...buildRepoRunContext(...),
// resumePrNumber}), not inherit a single run-wide value from this
// function.
export function buildRepoRunContext(
  {
    org,
    repo,
    baseRef,
    defaultBranch,
    docsDir,
    controlTowerRepoPath,
    controlTowerRef,
    grantPrincipleRef,
    repoEntry,
  },
  { resolveApprovers = listAuthorizedApprovers } = {},
) {
  const dev = repoEntry.dev ?? {};
  return {
    org,
    repo,
    baseRef,
    defaultBranch,
    docsDir,
    controlTowerRepoPath,
    controlTowerRef,
    grantPrincipleRef,
    commit: {
      coAuthoredBy: dev.commit?.co_authored_by ?? null,
      signoff: dev.commit?.signoff ?? false,
    },
    publishesOnMerge: dev.publishes_on_merge ?? false,
    authorizedApprovers: resolveApprovers({ org, repo }),
    recordedMergeShas: [],
    twoConsecutiveBlockedIssues: false,
    repeatedToolErrors: false,
  };
}

import { execFileSync } from "node:child_process";

import { fetchRouteText, parseRoute } from "./route-reader.mjs";

const PRINCIPLE_SKILL_MD_PATH =
  "plugins/openindu-control-tower/skills/principle/SKILL.md";

// Gathers the facts pr-lifecycle.mjs's evaluatePromotionReadiness/
// evaluatePostPromotionRecheck (E3, #35) need for guards G1-G11, by composing
// REAL gh/git calls and already-built real functions (route-reader's
// fetchRouteText/parseRoute for G11) -- no decision logic duplicated, this
// module only gathers facts, it does not evaluate any guard itself. G10's
// source-permission facts and dev-pause's isPaused (G11) are left as the
// caller's internalFacts, since F2's checkSourcePermissions already runs once
// per issue at intake time (step 1), not per merge-fact-gather.
//
// Verification confidence, stated honestly rather than implied uniformly:
// - gh pr view --json statusCheckRollup's shape ({name,status,conclusion}) was
//   verified against a REAL trace this session (PR-F1/#37, against PR #34).
// - gh pr view --json headRefOid/isDraft/mergeable/mergeStateStatus and the REST
//   pulls/{n}/files endpoint's {filename,status,additions,deletions} shape are
//   GitHub's documented, stable API behavior, but have NOT been exercised
//   against a real PR in this session -- unlike the statusCheckRollup trace
//   above, these are standard-docs-grounded, not live-verified.
// - git patch-id and merge-base --is-ancestor are standard porcelain/plumbing
//   with no API-shape ambiguity at all.
//
// Two facts genuinely have no real data source implemented here, by design,
// not by oversight -- stated plainly rather than guessed at:
// - baseCoverageThresholds/headCoverageThresholds: test-integrity.mjs's own
//   comment already says the exact config file and key names are "per
//   dev.checks, not this module's concern" -- there is no schema field for
//   this yet (same gap F4's PR noted). Both default to {}, which
//   findLoweredThresholds handles safely (zero entries, zero findings) --
//   this means a lowered-coverage-threshold check never fires until a repo's
//   dev.checks gains this field and a caller supplies real values.
// - moduleBoundariesTouched: "module boundary" has no native git/gh concept.
//   countTopLevelDirectories below is a documented heuristic (distinct
//   top-level path segments among changed files), not a verified-correct
//   algorithm for every repo's actual module layout.

function ghApiJson(endpoint, jqFilter) {
  const args = ["api", endpoint];
  if (jqFilter) args.push("--jq", jqFilter);
  const raw = execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return jqFilter ? raw.trim() : JSON.parse(raw);
}

function ghPrViewJson(org, repo, prNumber, fields) {
  const raw = execFileSync(
    "gh",
    [
      "pr",
      "view",
      String(prNumber),
      "--repo",
      `${org}/${repo}`,
      "--json",
      fields.join(","),
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(raw);
}

function execGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function defaultFetchPrSnapshot(org, repo, prNumber) {
  const data = ghPrViewJson(org, repo, prNumber, [
    "headRefOid",
    "isDraft",
    "mergeable",
    "statusCheckRollup",
  ]);
  const files = ghApiJson(`repos/${org}/${repo}/pulls/${prNumber}/files`).map(
    (f) => ({
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    }),
  );
  return {
    prHeadSha: data.headRefOid,
    isReady: !data.isDraft,
    hasConflicts: data.mergeable === "CONFLICTING",
    isMergeable: data.mergeable === "MERGEABLE",
    actualChecks: data.statusCheckRollup ?? [],
    changedFiles: files,
    totalLinesChanged: files.reduce(
      (sum, f) => sum + f.additions + f.deletions,
      0,
    ),
  };
}

export function defaultFetchDefaultBranchHeadSha(org, repo, branch) {
  return ghApiJson(`repos/${org}/${repo}/commits/${branch}`, ".sha");
}

// Same shape as dev.mjs's own defaultBranchHeadCiState (F8-1) -- duplicated as
// a one-line gh wrapper rather than imported, since dev.mjs is the skill entry
// point that CONSUMES engine/, not a dependency of it (and may auto-run main()
// on import).
export function defaultFetchDefaultBranchHeadConclusion(org, repo, branch) {
  return ghApiJson(
    `repos/${org}/${repo}/commits/${branch}/status`,
    ".state",
  ).toUpperCase();
}

export function defaultCheckAncestry(repoPath, ancestorSha, descendantRef) {
  try {
    execGit(
      ["merge-base", "--is-ancestor", ancestorSha, descendantRef],
      repoPath,
    );
    return true;
  } catch {
    return false;
  }
}

export function defaultComputeUnifiedDiff(repoPath, baseRef, headRef) {
  return execGit(["diff", `${baseRef}...${headRef}`], repoPath);
}

export function defaultComputePatchId(repoPath, baseRef, headRef) {
  const diff = defaultComputeUnifiedDiff(repoPath, baseRef, headRef);
  const output = execFileSync("git", ["patch-id", "--stable"], {
    cwd: repoPath,
    input: diff,
    encoding: "utf8",
  });
  return output.split(" ")[0] || null;
}

export function defaultFetchCodeownersText(org, repo, ref) {
  try {
    const response = ghApiJson(
      `repos/${org}/${repo}/contents/.github/CODEOWNERS?ref=${ref}`,
    );
    return Buffer.from(response.content, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function countTopLevelDirectories(changedPaths) {
  const tops = new Set(changedPaths.map((p) => p.split("/")[0]));
  return tops.size;
}

// context: { org, repo, prNumber, repoWorktreePath, baseRef, defaultBranch,
// controlTowerRepoPath, controlTowerRef, grantPrincipleRef }. Everything the
// caller already tracks internally (reviewedSha, ciEvaluatedSha,
// unresolvedMustFixCount, declaredPlanPaths,
// riskTier/priorRiskTier/confidence/reviewExpressedUncertainty,
// acceptanceCriteriaCrowdDerived, authorizedApprovers, snapshotBodyHash,
// source-permission facts, repoName, now) is passed in as internalFacts rather
// than re-derived here -- this function gathers only what a fresh gh/git read
// can answer, including G11's route.json/SKILL.md live reads (also fresh reads,
// just not guard-specific, so they belong here rather than being pushed onto
// the caller as "internal" data).
export async function gatherMergeFacts(
  context,
  internalFacts,
  {
    fetchPrSnapshot = defaultFetchPrSnapshot,
    fetchDefaultBranchHeadSha = defaultFetchDefaultBranchHeadSha,
    fetchDefaultBranchHeadConclusion = defaultFetchDefaultBranchHeadConclusion,
    checkAncestry = defaultCheckAncestry,
    computeUnifiedDiff = defaultComputeUnifiedDiff,
    computePatchId = defaultComputePatchId,
    fetchCodeownersText = defaultFetchCodeownersText,
    fetchRoute = (ref) => fetchRouteText(ref),
    fetchPrincipleSkillMd = (ref) =>
      fetchRouteText(ref, PRINCIPLE_SKILL_MD_PATH),
  } = {},
) {
  const {
    org,
    repo,
    prNumber,
    repoWorktreePath,
    baseRef,
    defaultBranch,
    controlTowerRepoPath,
    controlTowerRef,
    grantPrincipleRef,
  } = context;

  const prSnapshot = fetchPrSnapshot(org, repo, prNumber);
  const defaultBranchHeadSha = fetchDefaultBranchHeadSha(
    org,
    repo,
    defaultBranch,
  );
  const defaultBranchHeadConclusion = fetchDefaultBranchHeadConclusion(
    org,
    repo,
    defaultBranch,
  );
  const prIncludesDefaultBranchHead = checkAncestry(
    repoWorktreePath,
    defaultBranchHeadSha,
    prSnapshot.prHeadSha,
  );
  const unifiedDiff = computeUnifiedDiff(
    repoWorktreePath,
    baseRef,
    prSnapshot.prHeadSha,
  );
  const currentPatchId = computePatchId(
    repoWorktreePath,
    baseRef,
    prSnapshot.prHeadSha,
  );
  const changedPaths = prSnapshot.changedFiles.map((f) => f.path);
  const codeownersText = fetchCodeownersText(org, repo, defaultBranch);

  let routeReadSucceeded = true;
  let route = null;
  let defaultBranchSkillMdText = null;
  try {
    route = parseRoute(fetchRoute(controlTowerRef));
    defaultBranchSkillMdText = fetchPrincipleSkillMd(controlTowerRef);
  } catch {
    routeReadSucceeded = false;
  }
  const principleRefIsAncestorOfDefaultBranch = grantPrincipleRef
    ? checkAncestry(controlTowerRepoPath, grantPrincipleRef, controlTowerRef)
    : false;

  return {
    ...prSnapshot,
    changedPaths,
    unifiedDiff,
    currentPatchId,
    defaultBranchHeadSha,
    defaultBranchHeadConclusion,
    prIncludesDefaultBranchHead,
    codeownersText,
    moduleBoundariesTouched: countTopLevelDirectories(changedPaths),
    baseCoverageThresholds: {},
    headCoverageThresholds: {},
    routeReadSucceeded,
    route,
    defaultBranchSkillMdText,
    principleRefIsAncestorOfDefaultBranch,
    ...internalFacts,
  };
}

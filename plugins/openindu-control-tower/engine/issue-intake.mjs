import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { computeBodyHash } from "./guards-g7-g11.mjs";

// spec/005 section 2.1 step 1 also names a "complete: true" requirement on each
// collected issue, alongside the PR-exclusion collect-org-issues.mjs (stage 4 C1)
// already implements. That exact field/source is not resolved here -- it does not
// correspond to a documented field on GitHub's REST issue payload or gh CLI's own
// issue JSON output, and the spec gives no further definition. Known gap, stated
// rather than silently guessed at: this module does NOT filter on it. Flagged in
// this PR's own description for the record, not hidden in a comment only.

function defaultGhPermission(repoPath, login) {
  const raw = execFileSync(
    "gh",
    ["api", `repos/${repoPath}/collaborators/${login}/permission`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const { permission } = JSON.parse(raw);
  return permission === "admin" || permission === "write";
}

// G10's source-check facts for one issue: whether the author has write access, and
// the same for every commenter whose text actually entered the agent's context
// (spec/005 section 2.3-3 G10: "评论者无权限则其文本不进上下文" is enforced by the
// CALLER deciding which comments to include before this runs -- this function only
// evaluates permission for the commenters it's given, it does not itself filter).
export function checkSourcePermissions(
  { repoPath, authorLogin, commenterLogins },
  hasWritePermission = defaultGhPermission,
) {
  return {
    issueAuthorHasWrite: hasWritePermission(repoPath, authorLogin),
    commenterPermissions: commenterLogins.map((login) => ({
      login,
      hasWrite: hasWritePermission(repoPath, login),
    })),
  };
}

// One issue's full snapshot entry: the normalized issue (from collect-org-issues.mjs)
// plus its body-hash (G10's drift check: "正文哈希在合并前变化 -> 转人工") and source
// facts, bundled so step 4's guardG10 call later needs no re-fetch of either.
export function buildSnapshotEntry(issue, sourceFacts) {
  return {
    ...issue,
    bodyHashAtSnapshot: computeBodyHash(issue.body ?? ""),
    source: sourceFacts,
  };
}

export function buildSnapshot(issuesWithSourceFacts) {
  return {
    takenAt: new Date().toISOString(),
    issueCount: issuesWithSourceFacts.length,
    issues: issuesWithSourceFacts.map(({ issue, sourceFacts }) =>
      buildSnapshotEntry(issue, sourceFacts),
    ),
  };
}

export function writeSnapshot(path, snapshot) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}

// spec/005 section 4 criterion #14: "0 个 open issue 时干净退出并报告「0 项」".
export function formatZeroIssuesReport(repoName) {
  return `0 项: no open issues found for ${repoName} -- nothing to do, exiting cleanly`;
}

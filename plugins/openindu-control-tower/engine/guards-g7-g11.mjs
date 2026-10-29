import { createHash } from "node:crypto";

import { requiredOwners, parseCodeowners } from "./codeowners.mjs";
import { isCheckGreen } from "./ci-status.mjs";
import { isPaused } from "./dev-pause.mjs";
import { resolveRepoAuthorization } from "./route-reader.mjs";

// G7: the PR is ready (not draft), has no conflicts, and is mergeable. The
// "G1-G6, G8-G11 all passed before promotion" half of spec/005 section
// 2.3's G7 is a process invariant enforced by the orchestration that calls
// this guard (it only promotes draft->ready after checking those guards),
// not something re-derivable here after the fact -- which is exactly why
// the spec has the orchestration re-check G1, G2, G7, G8, G10, G11 again
// right after promotion.
export function guardG7({ isReady, hasConflicts, isMergeable }) {
  const reasons = [];
  if (!isReady) reasons.push("PR is still draft (G7)");
  if (hasConflicts) reasons.push("PR has conflicts (G7)");
  if (!isMergeable) reasons.push("PR is not mergeable (G7)");
  return reasons.length > 0 ? { pass: false, reason: reasons.join("; ") } : { pass: true };
}

// G8: the default branch's CURRENT HEAD CI is green, and the PR already
// includes that HEAD. Ancestry (whether the PR branch actually contains
// that commit) needs a real git/gh call, so it is supplied as a fact by
// the caller, same pattern as G1's ciRanOnCurrentHead.
export function guardG8({ defaultBranchHeadConclusion, prIncludesDefaultBranchHead }) {
  const reasons = [];
  if (!isCheckGreen(defaultBranchHeadConclusion)) {
    reasons.push(`default branch HEAD CI is not green: ${defaultBranchHeadConclusion} (G8)`);
  }
  if (!prIncludesDefaultBranchHead) {
    reasons.push("PR does not yet include the default branch's current HEAD (G8)");
  }
  return reasons.length > 0 ? { pass: false, reason: reasons.join("; ") } : { pass: true };
}

// G9: every CODEOWNERS owner required by the changed paths must itself be
// an authorized approver (RULE 5.3) -- a consistency check between the
// CODEOWNERS file and the repo's actual approver roster, not a check of
// who approved this specific PR.
export function guardG9({ changedPaths, codeownersText, authorizedApprovers }) {
  const entries = parseCodeowners(codeownersText ?? "");
  const required = requiredOwners(changedPaths, entries);
  const unauthorized = required.filter((owner) => !authorizedApprovers.includes(owner));
  if (unauthorized.length > 0) {
    return {
      pass: false,
      reason: `CODEOWNERS names non-authorized-approver(s): ${unauthorized.join(", ")} (G9)`,
    };
  }
  return { pass: true };
}

export function computeBodyHash(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// G10: the issue author and every commenter who entered the agent's
// context have write permission on the repo; the body hash matches the
// snapshot taken when the issue was first collected; acceptance criteria
// were not crowd-derived (a thin issue is always PR-only, never merged).
export function guardG10({
  issueAuthorHasWrite,
  commenterPermissions,
  currentBodyHash,
  snapshotBodyHash,
  acceptanceCriteriaCrowdDerived,
}) {
  const reasons = [];
  if (!issueAuthorHasWrite) reasons.push("issue author lacks write permission (G10)");
  const noWriteCommenters = (commenterPermissions ?? []).filter((c) => !c.hasWrite);
  if (noWriteCommenters.length > 0) {
    reasons.push(
      `commenter(s) without write permission entered the agent context: ${noWriteCommenters
        .map((c) => c.login)
        .join(", ")} (G10)`,
    );
  }
  if (currentBodyHash !== snapshotBodyHash) {
    reasons.push("issue body hash no longer matches the snapshot (G10)");
  }
  if (acceptanceCriteriaCrowdDerived) {
    reasons.push("acceptance criteria were crowd-derived, not issue-stated (G10)");
  }
  return reasons.length > 0 ? { pass: false, reason: reasons.join("; ") } : { pass: true };
}

// G11: live grant validity, checked at merge time, not admission time.
// Fail-closed -- any upstream read failure (route.json, SKILL.md) means no
// merge, full stop, regardless of what the rest of the facts say.
export function guardG11({
  routeReadSucceeded,
  route,
  repoName,
  now,
  principleRefIsAncestorOfDefaultBranch,
  defaultBranchSkillMdText,
  pauseFilePath,
}) {
  if (!routeReadSucceeded) {
    return { pass: false, reason: "live read of control-tower's route failed (G11)" };
  }
  const authorization = resolveRepoAuthorization(route, repoName, now);
  if (!authorization.authorized) {
    return { pass: false, reason: `${authorization.reason} (G11)` };
  }
  const reasons = [];
  if (!principleRefIsAncestorOfDefaultBranch) {
    reasons.push("grant's principle_ref is not an ancestor of the default branch (G11)");
  }
  if (!defaultBranchSkillMdText?.includes("SA-1")) {
    reasons.push("default branch SKILL.md no longer carries the SA-1 marker (G11)");
  }
  if (isPaused(pauseFilePath)) {
    reasons.push("local .dev-pause is set (G11)");
  }
  return reasons.length > 0 ? { pass: false, reason: reasons.join("; ") } : { pass: true };
}

import { allRequiredChecksGreen } from "./ci-status.mjs";

// G1: PR head SHA = reviewed SHA = CI-evaluated SHA. The one exception is an
// update-branch/rebase that changes the head but leaves the PR's own diff
// patch-id equivalent to what was reviewed -- then the review carries over,
// but CI must still have run on the new head before this can pass.
export function guardG1({
  prHeadSha,
  reviewedSha,
  ciEvaluatedSha,
  reviewedPatchId,
  currentPatchId,
  ciRanOnCurrentHead,
}) {
  if (prHeadSha === reviewedSha && prHeadSha === ciEvaluatedSha) {
    return { pass: true };
  }
  if (reviewedPatchId && currentPatchId && reviewedPatchId === currentPatchId) {
    if (!ciRanOnCurrentHead) {
      return {
        pass: false,
        reason: "patch-id matches the reviewed version, but CI has not rerun on the new head (G1)",
      };
    }
    return { pass: true, reusedReview: true };
  }
  return {
    pass: false,
    reason: "PR head, reviewed SHA and CI-evaluated SHA diverge, and the patch is not equivalent to what was reviewed (G1)",
  };
}

// G2: every required check (human-declared dev.required_checks union
// branch-protection-required) is SUCCESS for the current head.
export function guardG2({ requiredCheckNames, actualChecks }) {
  const { allGreen, missing } = allRequiredChecksGreen(requiredCheckNames, actualChecks);
  if (!allGreen) {
    return { pass: false, reason: `required check(s) not green: ${missing.join(", ")} (G2)` };
  }
  return { pass: true };
}

// G3: independent review has no unresolved must-fix. There is deliberately
// no "an agent approved it" input anywhere in this function -- per spec/005
// section 2.3-3, an agent review may only veto a merge, never promote one,
// so nothing here can turn pass:true except the absence of objections.
export function guardG3({ unresolvedMustFixCount }) {
  if (unresolvedMustFixCount > 0) {
    return {
      pass: false,
      reason: `${unresolvedMustFixCount} unresolved must-fix review comment(s) (G3)`,
    };
  }
  return { pass: true };
}

// G5: size <=400 lines AND <=1 module boundary -- the AND is deliberately
// stricter than RULE 4's own OR, and no repo's dev.* data may relax it.
export function guardG5({ totalLinesChanged, moduleBoundariesTouched }) {
  const reasons = [];
  if (totalLinesChanged > 400) {
    reasons.push(`${totalLinesChanged} lines changed, exceeds 400 (G5)`);
  }
  if (moduleBoundariesTouched > 1) {
    reasons.push(`touches ${moduleBoundariesTouched} module boundaries, exceeds 1 (G5)`);
  }
  return reasons.length > 0 ? { pass: false, reason: reasons.join("; ") } : { pass: true };
}

const RISK_TIERS = ["L0", "L1", "L2", "L3"];

function tierRank(tier) {
  const rank = RISK_TIERS.indexOf(tier);
  if (rank === -1) throw new Error(`Unknown risk tier: ${JSON.stringify(tier)}`);
  return rank;
}

// G6: risk <=L2; a repo's declared tier may only ever rise run over run,
// never fall; confidence >=0.80 and the review did not express uncertainty.
export function guardG6({ riskTier, priorRiskTier, confidence, reviewExpressedUncertainty }) {
  const reasons = [];
  if (tierRank(riskTier) > tierRank("L2")) {
    reasons.push(`risk tier ${riskTier} exceeds L2 (G6)`);
  }
  if (priorRiskTier && tierRank(riskTier) < tierRank(priorRiskTier)) {
    reasons.push(`risk tier lowered from ${priorRiskTier} to ${riskTier} (G6)`);
  }
  if (confidence < 0.8) {
    reasons.push(`confidence ${confidence} is below 0.80 (G6)`);
  }
  if (reviewExpressedUncertainty) {
    reasons.push("review expressed uncertainty (G6)");
  }
  return reasons.length > 0 ? { pass: false, reason: reasons.join("; ") } : { pass: true };
}

// spec/005 section 2.2: the review panel scales by complexity so a one-line
// typo doesn't get the full panel (exactly the "wrap an if/else in an agent"
// anti-pattern RULE 3 warns about). Tier is decided by deterministic rules
// first; the LLM may only escalate a tier, never downgrade one, and a
// low-confidence or self-reported-uncertain signal always routes to a human
// outright rather than to any tier (reusing /issue-pipeline's 0.80
// threshold). Section 2.3's L3-action check is evaluated separately and
// first -- if it fires, the issue never enters tier selection at all.

export const TIERS = Object.freeze(["lite", "standard", "high-risk"]);

// Section 2.2's table, verbatim: how many independent proposals, which
// proposal strategies, and which reviewer perspectives run at the plan
// stage and the implementation-review stage, per tier.
export const PANEL_COMPOSITION = Object.freeze({
  lite: Object.freeze({
    proposals: 1,
    proposalStrategies: Object.freeze(["direct"]),
    planReviewers: Object.freeze(["general"]),
    implReviewers: Object.freeze(["general"]),
    contractFirst: false,
  }),
  standard: Object.freeze({
    proposals: 3,
    proposalStrategies: Object.freeze(["minimal-change", "robustness", "architecture-fit"]),
    planReviewers: Object.freeze(["correctness", "security", "maintainability-architecture"]),
    implReviewers: Object.freeze(["correctness", "security", "maintainability", "architecture"]),
    contractFirst: false,
  }),
  "high-risk": Object.freeze({
    proposals: 3,
    proposalStrategies: Object.freeze(["minimal-change", "robustness", "architecture-fit"]),
    planReviewers: Object.freeze([
      "correctness",
      "security",
      "maintainability-architecture",
      "security-challenger",
      "test-challenger",
    ]),
    implReviewers: Object.freeze([
      "correctness",
      "security",
      "maintainability",
      "architecture",
      "security-challenger",
      "test-challenger",
    ]),
    contractFirst: true,
  }),
});

// Deliberately a small local duplicate of guards-core.mjs's own RISK_TIERS
// concept rather than an import: it's the same stable org-wide L0-L3 scale,
// but this module's job (tier selection) is a different concern from
// guards-core's (merge-guard evaluation), and the scale is unlikely to
// drift independently in the two places.
const RISK_TIERS = ["L0", "L1", "L2", "L3"];

function riskRank(tier) {
  const rank = RISK_TIERS.indexOf(tier);
  if (rank === -1) throw new Error(`Unknown risk tier: ${JSON.stringify(tier)}`);
  return rank;
}

function tierRank(tier) {
  const rank = TIERS.indexOf(tier);
  if (rank === -1) throw new Error(`Unknown review tier: ${JSON.stringify(tier)}`);
  return rank;
}

const CONFIDENCE_ESCALATION_THRESHOLD = 0.8;
const LITE_MAX_ESTIMATED_LINES = 50;
const LITE_MAX_RISK_TIER = "L1";

// Section 2.3's structural pre-check: issues needing an L3 action never
// enter implementation at all. The plan is still solidified; the runner
// just never acts on it. Caller checks this BEFORE calling baselineTier.
const L3_ACTION_TYPES = Object.freeze([
  "prod-deploy",
  "data-deletion",
  "permission-change",
  "secret-change",
  "prod-sql",
]);

export function requiresHumanForL3Action(declaredActionTypes) {
  if (!Array.isArray(declaredActionTypes)) return false;
  return declaredActionTypes.some((action) => L3_ACTION_TYPES.includes(action));
}

// The deterministic baseline, from signals the proposal itself declares --
// never from free-text the LLM wrote, so there is nothing here for an LLM
// to argue its way out of. touchesSensitiveArea is computed by the caller
// (path-rules.mjs's changedProtectedPaths covers the path half of it) and
// passed in; this module stays free of filesystem/path logic.
export function baselineTier({
  moduleCount,
  riskTier,
  estimatedLines,
  isDocsOrConfigOnly,
  touchesSensitiveArea,
}) {
  if (touchesSensitiveArea) return "high-risk";
  if (moduleCount > 1) return "high-risk";
  if (
    moduleCount <= 1 &&
    riskRank(riskTier) <= riskRank(LITE_MAX_RISK_TIER) &&
    estimatedLines <= LITE_MAX_ESTIMATED_LINES &&
    isDocsOrConfigOnly
  ) {
    return "lite";
  }
  return "standard";
}

// The LLM's own tier signal can only move the baseline UP, never down.
// A self-reported-uncertain review, or confidence below the threshold,
// overrides tier selection entirely and returns "human" -- not a tier.
export function applyLlmTierSignal(baseline, { suggestedTier, confidence, reviewerStatedUncertain } = {}) {
  if (reviewerStatedUncertain) return "human";
  if (typeof confidence === "number" && confidence < CONFIDENCE_ESCALATION_THRESHOLD) return "human";
  if (suggestedTier == null) return baseline;
  const resolvedRank = Math.max(tierRank(baseline), tierRank(suggestedTier));
  return TIERS[resolvedRank];
}

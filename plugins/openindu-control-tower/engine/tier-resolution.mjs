import {
  applyLlmTierSignal,
  baselineTier,
  requiresHumanForL3Action,
} from "./review-panel.mjs";

// spec/005 section 2.2: "档位先由确定性规则判定（标签、方案声明的路径与预估行数）" --
// the baseline's inputs (estimated lines, module count, whether this is docs/config
// only, whether it touches a sensitive area) and the L3-action check all describe a
// PROPOSED CHANGE, which does not exist yet at issue intake (step 1 only has GitHub
// issue metadata). This module resolves tier via a preliminary SCOPING proposal: one
// proposal call using a neutral strategy, whose structured output self-declares
// those scope signals alongside its summary.
//
// That same call's own suggestedTier/confidence/reviewerStatedUncertain doubles as
// the "LLM signal" applyLlmTierSignal expects -- no separate reviewer call has
// happened yet at this point in the pipeline, so there is no other LLM opinion
// available to use instead. This is a documented design choice, not a literal spec
// mechanism: the spec does not name which call supplies that signal.
//
// The scoping proposal itself is always discarded afterward, even for a "lite"
// outcome where the real panel also wants exactly one proposal: its strategy
// ("scoping") does not match PANEL_COMPOSITION.lite's declared strategy ("direct"),
// and splicing it in would be a correctness risk for a small, one-time cost saving.
// runStep2 always runs fresh afterward with the resolved tier.
export async function resolveTier(issue, generateScopingProposal) {
  const scoping = await generateScopingProposal(issue);

  if (requiresHumanForL3Action(scoping.declaredActionTypes ?? [])) {
    return {
      outcome: "HUMAN_REQUIRED",
      reason: "declared action requires an L3 human action",
      scoping,
    };
  }

  const baseline = baselineTier({
    moduleCount: scoping.moduleCount,
    riskTier: scoping.riskTier,
    estimatedLines: scoping.estimatedLines,
    isDocsOrConfigOnly: scoping.isDocsOrConfigOnly,
    touchesSensitiveArea: scoping.touchesSensitiveArea,
  });

  const resolved = applyLlmTierSignal(baseline, {
    suggestedTier: scoping.suggestedTier,
    confidence: scoping.confidence,
    reviewerStatedUncertain: scoping.reviewerStatedUncertain,
  });

  if (resolved === "human") {
    return {
      outcome: "HUMAN_REQUIRED",
      reason: "low confidence or self-reported uncertainty",
      baseline,
      scoping,
    };
  }

  return { outcome: "TIER_RESOLVED", tier: resolved, baseline, scoping };
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  PANEL_COMPOSITION,
  TIERS,
  applyLlmTierSignal,
  baselineTier,
  requiresHumanForL3Action,
} from "./review-panel.mjs";

// --- requiresHumanForL3Action -----------------------------------------
test("an L3 action type (e.g. prod-sql) requires human handling", () =>
  assert.equal(requiresHumanForL3Action(["prod-sql"]), true));
test("a non-L3 action list does not require human handling", () =>
  assert.equal(requiresHumanForL3Action(["refactor", "docs"]), false));
test("an empty or missing action list does not require human handling", () => {
  assert.equal(requiresHumanForL3Action([]), false);
  assert.equal(requiresHumanForL3Action(undefined), false);
});

// --- baselineTier -------------------------------------------------------
test("a single-module, low-risk, small, docs-only change is lite", () =>
  assert.equal(
    baselineTier({
      moduleCount: 1,
      riskTier: "L0",
      estimatedLines: 10,
      isDocsOrConfigOnly: true,
      touchesSensitiveArea: false,
    }),
    "lite",
  ));
test("51 estimated lines on an otherwise-lite change is standard, not lite", () =>
  assert.equal(
    baselineTier({
      moduleCount: 1,
      riskTier: "L0",
      estimatedLines: 51,
      isDocsOrConfigOnly: true,
      touchesSensitiveArea: false,
    }),
    "standard",
  ));
test("non-docs content on an otherwise-lite change is standard, not lite", () =>
  assert.equal(
    baselineTier({
      moduleCount: 1,
      riskTier: "L0",
      estimatedLines: 10,
      isDocsOrConfigOnly: false,
      touchesSensitiveArea: false,
    }),
    "standard",
  ));
test("L2 risk on an otherwise-lite change is standard, not lite (lite caps at L1)", () =>
  assert.equal(
    baselineTier({
      moduleCount: 1,
      riskTier: "L2",
      estimatedLines: 10,
      isDocsOrConfigOnly: true,
      touchesSensitiveArea: false,
    }),
    "standard",
  ));
test("cross-module (moduleCount > 1) is high-risk regardless of size", () =>
  assert.equal(
    baselineTier({
      moduleCount: 2,
      riskTier: "L0",
      estimatedLines: 5,
      isDocsOrConfigOnly: true,
      touchesSensitiveArea: false,
    }),
    "high-risk",
  ));
test("touching a sensitive area is high-risk regardless of size", () =>
  assert.equal(
    baselineTier({
      moduleCount: 1,
      riskTier: "L0",
      estimatedLines: 5,
      isDocsOrConfigOnly: true,
      touchesSensitiveArea: true,
    }),
    "high-risk",
  ));
test("an ordinary multi-line code change with no special signal is standard", () =>
  assert.equal(
    baselineTier({
      moduleCount: 1,
      riskTier: "L1",
      estimatedLines: 120,
      isDocsOrConfigOnly: false,
      touchesSensitiveArea: false,
    }),
    "standard",
  ));

// --- applyLlmTierSignal --------------------------------------------------
test("a stated-uncertain review always routes to human, even with high confidence", () =>
  assert.equal(
    applyLlmTierSignal("lite", { suggestedTier: "lite", confidence: 0.99, reviewerStatedUncertain: true }),
    "human",
  ));
test("confidence below 0.80 always routes to human", () =>
  assert.equal(applyLlmTierSignal("standard", { confidence: 0.79 }), "human"));
test("confidence at exactly 0.80 does not route to human", () =>
  assert.notEqual(applyLlmTierSignal("standard", { confidence: 0.8 }), "human"));
test("no suggested tier and sufficient confidence keeps the baseline", () =>
  assert.equal(applyLlmTierSignal("standard", { confidence: 0.9 }), "standard"));
test("a suggested tier above the baseline escalates", () =>
  assert.equal(
    applyLlmTierSignal("lite", { suggestedTier: "high-risk", confidence: 0.9 }),
    "high-risk",
  ));
test("a suggested tier below the baseline is ignored -- the LLM may never downgrade", () =>
  assert.equal(
    applyLlmTierSignal("high-risk", { suggestedTier: "lite", confidence: 0.9 }),
    "high-risk",
  ));

// --- PANEL_COMPOSITION ----------------------------------------------------
test("every tier has a panel composition entry", () => {
  for (const tier of TIERS) {
    assert.ok(PANEL_COMPOSITION[tier], `missing composition for tier ${tier}`);
  }
});
test("lite is exactly 1 proposal and 1 reviewer at each stage", () => {
  assert.equal(PANEL_COMPOSITION.lite.proposals, 1);
  assert.equal(PANEL_COMPOSITION.lite.planReviewers.length, 1);
  assert.equal(PANEL_COMPOSITION.lite.implReviewers.length, 1);
});
test("standard is 3 proposals, 3 plan reviewers, 4 implementation reviewers", () => {
  assert.equal(PANEL_COMPOSITION.standard.proposals, 3);
  assert.equal(PANEL_COMPOSITION.standard.planReviewers.length, 3);
  assert.equal(PANEL_COMPOSITION.standard.implReviewers.length, 4);
});
test("high-risk adds a security challenger and test challenger beyond standard, and is contract-first", () => {
  assert.ok(PANEL_COMPOSITION["high-risk"].planReviewers.includes("security-challenger"));
  assert.ok(PANEL_COMPOSITION["high-risk"].planReviewers.includes("test-challenger"));
  assert.equal(PANEL_COMPOSITION["high-risk"].contractFirst, true);
  assert.equal(PANEL_COMPOSITION.standard.contractFirst, false);
});

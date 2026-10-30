import assert from "node:assert/strict";
import test from "node:test";

import { resolveTier } from "./tier-resolution.mjs";

function scoping(overrides = {}) {
  return {
    summary: "x",
    estimatedLines: 10,
    moduleCount: 1,
    isDocsOrConfigOnly: true,
    touchesSensitiveArea: false,
    riskTier: "L0",
    declaredActionTypes: [],
    suggestedTier: null,
    confidence: 0.95,
    reviewerStatedUncertain: false,
    ...overrides,
  };
}

test("resolveTier reports HUMAN_REQUIRED when the scoping proposal declares an L3 action type", async () => {
  const result = await resolveTier(
    { number: 1, title: "t", body: "b" },
    async () => scoping({ declaredActionTypes: ["prod-sql"] }),
  );
  assert.equal(result.outcome, "HUMAN_REQUIRED");
  assert.match(result.reason, /L3/);
});

test("resolveTier resolves to lite for a small, low-risk, docs-only, non-sensitive, confident scoping result", async () => {
  const result = await resolveTier(
    { number: 1, title: "t", body: "b" },
    async () => scoping(),
  );
  assert.equal(result.outcome, "TIER_RESOLVED");
  assert.equal(result.tier, "lite");
});

test("resolveTier resolves to standard (the default) when the scoping result doesn't meet lite's bar", async () => {
  const result = await resolveTier(
    { number: 1, title: "t", body: "b" },
    async () => scoping({ isDocsOrConfigOnly: false }),
  );
  assert.equal(result.outcome, "TIER_RESOLVED");
  assert.equal(result.tier, "standard");
});

test("resolveTier resolves to high-risk when touchesSensitiveArea is true, with no HUMAN_REQUIRED outcome", async () => {
  const result = await resolveTier(
    { number: 1, title: "t", body: "b" },
    async () => scoping({ touchesSensitiveArea: true }),
  );
  assert.equal(result.outcome, "TIER_RESOLVED");
  assert.equal(result.tier, "high-risk");
});

test("resolveTier lets the scoping call's own suggestedTier escalate a lite baseline to high-risk", async () => {
  const result = await resolveTier(
    { number: 1, title: "t", body: "b" },
    async () => scoping({ suggestedTier: "high-risk" }),
  );
  assert.equal(result.outcome, "TIER_RESOLVED");
  assert.equal(result.tier, "high-risk");
});

test("resolveTier reports HUMAN_REQUIRED when confidence is below the 0.80 threshold", async () => {
  const result = await resolveTier(
    { number: 1, title: "t", body: "b" },
    async () => scoping({ confidence: 0.5 }),
  );
  assert.equal(result.outcome, "HUMAN_REQUIRED");
});

test("resolveTier reports HUMAN_REQUIRED when the scoping call states it is uncertain, even with high confidence", async () => {
  const result = await resolveTier(
    { number: 1, title: "t", body: "b" },
    async () => scoping({ reviewerStatedUncertain: true, confidence: 0.99 }),
  );
  assert.equal(result.outcome, "HUMAN_REQUIRED");
});

import assert from "node:assert/strict";
import test from "node:test";

import { guardG1, guardG2, guardG3, guardG5, guardG6 } from "./guards-core.mjs";

// --- G1 --------------------------------------------------------------
test("G1 passes when head, reviewed and CI-evaluated SHA all match", () =>
  assert.equal(
    guardG1({ prHeadSha: "abc", reviewedSha: "abc", ciEvaluatedSha: "abc" }).pass,
    true,
  ));
test("G1 fails when the head SHA diverges from the reviewed SHA with no patch-id match", () =>
  assert.equal(
    guardG1({ prHeadSha: "new", reviewedSha: "abc", ciEvaluatedSha: "abc" }).pass,
    false,
  ));
test("G1 reuses the review on a patch-id-equivalent rebase once CI reran on the new head", () => {
  const verdict = guardG1({
    prHeadSha: "new",
    reviewedSha: "old",
    ciEvaluatedSha: "new",
    reviewedPatchId: "p1",
    currentPatchId: "p1",
    ciRanOnCurrentHead: true,
  });
  assert.equal(verdict.pass, true);
  assert.equal(verdict.reusedReview, true);
});
test("G1 fails a patch-id-equivalent rebase if CI has not yet rerun on the new head", () =>
  assert.equal(
    guardG1({
      prHeadSha: "new",
      reviewedSha: "old",
      ciEvaluatedSha: "old",
      reviewedPatchId: "p1",
      currentPatchId: "p1",
      ciRanOnCurrentHead: false,
    }).pass,
    false,
  ));

// --- G2 --------------------------------------------------------------
test("G2 passes when all required checks are SUCCESS", () =>
  assert.equal(
    guardG2({
      requiredCheckNames: ["test"],
      actualChecks: [{ name: "test", conclusion: "SUCCESS" }],
    }).pass,
    true,
  ));
test("G2 fails when a required check is missing", () =>
  assert.equal(
    guardG2({ requiredCheckNames: ["secret-scan"], actualChecks: [] }).pass,
    false,
  ));

// --- G3 --------------------------------------------------------------
test("G3 passes with zero unresolved must-fix comments", () =>
  assert.equal(guardG3({ unresolvedMustFixCount: 0 }).pass, true));
test("G3 fails with at least one unresolved must-fix comment", () =>
  assert.equal(guardG3({ unresolvedMustFixCount: 1 }).pass, false));

// --- G5 --------------------------------------------------------------
test("G5 passes at or under 400 lines and 1 module boundary", () =>
  assert.equal(
    guardG5({ totalLinesChanged: 400, moduleBoundariesTouched: 1 }).pass,
    true,
  ));
test("G5 fails over 400 lines even within one module boundary", () =>
  assert.equal(
    guardG5({ totalLinesChanged: 401, moduleBoundariesTouched: 1 }).pass,
    false,
  ));
test("G5 fails across more than one module boundary even under 400 lines", () =>
  assert.equal(
    guardG5({ totalLinesChanged: 10, moduleBoundariesTouched: 2 }).pass,
    false,
  ));

// --- G6 --------------------------------------------------------------
const okG6 = { riskTier: "L2", confidence: 0.9, reviewExpressedUncertainty: false };
test("G6 passes at L2, high confidence, no expressed uncertainty", () =>
  assert.equal(guardG6(okG6).pass, true));
test("G6 fails above L2", () =>
  assert.equal(guardG6({ ...okG6, riskTier: "L3" }).pass, false));
test("G6 fails when the risk tier is lowered from a prior run", () =>
  assert.equal(
    guardG6({ ...okG6, riskTier: "L1", priorRiskTier: "L2" }).pass,
    false,
  ));
test("G6 passes when the risk tier rises from a prior run", () =>
  assert.equal(
    guardG6({ ...okG6, riskTier: "L2", priorRiskTier: "L1" }).pass,
    true,
  ));
test("G6 fails below the 0.80 confidence floor", () =>
  assert.equal(guardG6({ ...okG6, confidence: 0.79 }).pass, false));
test("G6 fails when the review expressed uncertainty, even at high confidence", () =>
  assert.equal(
    guardG6({ ...okG6, reviewExpressedUncertainty: true }).pass,
    false,
  ));
test("G6 rejects an unknown risk tier instead of silently passing it", () =>
  assert.throws(() => guardG6({ ...okG6, riskTier: "L7" }), /Unknown risk tier/));

import assert from "node:assert/strict";
import test from "node:test";

import { computeOutcomeRates, computeRollbackRate } from "./run-report.mjs";

test("computeOutcomeRates with all MERGED reports 0 degradation and 0 human-correction", () => {
  const rates = computeOutcomeRates([
    { issueNumber: 1, state: "MERGED" },
    { issueNumber: 2, state: "MERGED" },
  ]);
  assert.equal(rates.degradationRate, 0);
  assert.equal(rates.humanCorrectionRate, 0);
  assert.equal(rates.total, 2);
});

test("computeOutcomeRates counts HUMAN_REQUIRED/HUMAN_MERGE_REQUIRED/NEEDS_TRIAGE as both degraded and human-correction", () => {
  const rates = computeOutcomeRates([
    { issueNumber: 1, state: "MERGED" },
    { issueNumber: 2, state: "HUMAN_REQUIRED" },
    { issueNumber: 3, state: "HUMAN_MERGE_REQUIRED" },
    { issueNumber: 4, state: "NEEDS_TRIAGE" },
  ]);
  assert.equal(rates.degradationRate, 0.75);
  assert.equal(rates.humanCorrectionRate, 0.75);
});

test("computeOutcomeRates counts BLOCKED/FAILED as degraded but NOT as human-correction", () => {
  const rates = computeOutcomeRates([
    { issueNumber: 1, state: "MERGED" },
    { issueNumber: 2, state: "BLOCKED" },
    { issueNumber: 3, state: "FAILED" },
    { issueNumber: 4, state: "PR_GREEN" },
  ]);
  assert.equal(rates.degradationRate, 0.5);
  assert.equal(rates.humanCorrectionRate, 0);
});

test("computeOutcomeRates with zero issues reports zero rates rather than dividing by zero", () => {
  const rates = computeOutcomeRates([]);
  assert.equal(rates.degradationRate, 0);
  assert.equal(rates.humanCorrectionRate, 0);
  assert.equal(rates.total, 0);
});

test("computeRollbackRate is 0 when no recorded merge's sha appears in a revert commit message", () => {
  const result = computeRollbackRate(
    [{ issueNumber: 1, mergeSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    ["unrelated commit", "another commit"],
  );
  assert.equal(result.rollbackRate, 0);
  assert.deepEqual(result.reverted, []);
});

test("computeRollbackRate detects a revert of one of several recorded merges", () => {
  const merges = [
    { issueNumber: 1, mergeSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    { issueNumber: 2, mergeSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  ];
  const result = computeRollbackRate(merges, [
    "This reverts commit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.",
  ]);
  assert.equal(result.rollbackRate, 0.5);
  assert.deepEqual(result.reverted, [merges[0]]);
});

test("computeRollbackRate with zero recorded merges reports 0 rather than dividing by zero", () => {
  const result = computeRollbackRate([], ["This reverts commit aaaaaaa."]);
  assert.equal(result.rollbackRate, 0);
  assert.deepEqual(result.reverted, []);
});

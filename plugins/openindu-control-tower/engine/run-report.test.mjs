import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCiForReport,
  computeOutcomeRates,
  computeRollbackRate,
  renderRunReport,
} from "./run-report.mjs";

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

test("classifyCiForReport reports N/A when no PR was ever opened", () => {
  assert.equal(classifyCiForReport({ state: "HUMAN_REQUIRED" }), "N/A");
});

test("classifyCiForReport reports green for MERGED, PR_GREEN, and FAILED -- all three can only be reached after CI went green", () => {
  assert.equal(classifyCiForReport({ state: "MERGED", prNumber: 1 }), "green");
  assert.equal(
    classifyCiForReport({ state: "PR_GREEN", prNumber: 1 }),
    "green",
  );
  assert.equal(classifyCiForReport({ state: "FAILED", prNumber: 1 }), "green");
});

test("classifyCiForReport reports not green for a HUMAN_MERGE_REQUIRED carrying reason and no failures (the CI-retry-exhausted shape)", () => {
  assert.equal(
    classifyCiForReport({
      state: "HUMAN_MERGE_REQUIRED",
      prNumber: 1,
      reason: "CI did not turn green after 2 fix attempt(s)",
    }),
    "not green",
  );
});

test("classifyCiForReport reports green for a HUMAN_MERGE_REQUIRED carrying failures (a promotion-guard rejection, which only runs after CI was green)", () => {
  assert.equal(
    classifyCiForReport({
      state: "HUMAN_MERGE_REQUIRED",
      prNumber: 1,
      failures: ["G9"],
    }),
    "green",
  );
});

test("renderRunReport renders the full matrix, rates, and a Complete verdict for an all-clean run -- exact snapshot", () => {
  const report = renderRunReport({
    issueResults: [
      {
        issueNumber: 1,
        state: "MERGED",
        solutionDocument: "doc",
        implementationReviewDocument: "doc",
        prNumber: 10,
        mergeCommit: "abc123",
      },
      {
        issueNumber: 2,
        state: "NO_ACTION",
      },
    ],
    outcomeRates: { degradationRate: 0, humanCorrectionRate: 0, total: 2 },
    rollbackRate: { rollbackRate: 0, reverted: [] },
  });

  assert.equal(
    report,
    [
      "# /dev run report",
      "",
      "| Issue | 方案 | 评审 | PR | CI | 合并读回 | 状态 |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| #1 | ✓ | ✓ | 10 | green | abc123 | MERGED |",
      "| #2 | — | — | — | N/A | N/A | NO_ACTION |",
      "",
      "## Rates",
      "",
      "- Degradation rate: 0.0% (2 issue(s))",
      "- Human-correction rate: 0.0%",
      "- Rollback rate: 0.0%",
      "",
      "Complete: every attempted issue reached a clean terminal state.",
    ].join("\n"),
  );
});

test("renderRunReport reports Partially complete with a count when any issue is not clean, and includes the RULE 11 checklist when given one", () => {
  const report = renderRunReport({
    issueResults: [
      { issueNumber: 1, state: "MERGED", prNumber: 10, mergeCommit: "sha1" },
      { issueNumber: 2, state: "HUMAN_REQUIRED", reason: "ambiguous" },
    ],
    outcomeRates: { degradationRate: 0.5, humanCorrectionRate: 0.5, total: 2 },
    rollbackRate: { rollbackRate: 0, reverted: [] },
    rule11Checklist: "- [x] ③ submodule pointer\n- [ ] ④ image build",
  });

  assert.match(report, /Partially complete: 1 issue\(s\)/);
  assert.match(report, /## RULE 11 delivery status/);
  assert.match(report, /- \[x\] ③ submodule pointer/);
});

test("renderRunReport omits the RULE 11 section entirely when rule11Checklist is null", () => {
  const report = renderRunReport({
    issueResults: [],
    outcomeRates: { degradationRate: 0, humanCorrectionRate: 0, total: 0 },
    rollbackRate: { rollbackRate: 0, reverted: [] },
  });

  assert.doesNotMatch(report, /RULE 11/);
});

test("renderRunReport reports a dry-run result (no state field) as DRY_RUN rather than UNKNOWN", () => {
  const report = renderRunReport({
    issueResults: [
      {
        issueNumber: 5,
        dryRun: true,
        solutionDocument: "doc",
        tier: "lite",
      },
    ],
    outcomeRates: { degradationRate: 0, humanCorrectionRate: 0, total: 0 },
    rollbackRate: { rollbackRate: 0, reverted: [] },
  });

  assert.match(report, /\| #5 \| ✓ \| — \| — \| N\/A \| N\/A \| DRY_RUN \|/);
});

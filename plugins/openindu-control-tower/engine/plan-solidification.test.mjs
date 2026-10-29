import assert from "node:assert/strict";
import test from "node:test";

import { pickBestProposal, renderSolutionDocument, totalScore } from "./plan-solidification.mjs";

// --- totalScore -----------------------------------------------------------
test("totalScore sums every reviewer perspective's score", () =>
  assert.equal(totalScore({ correctness: 4, security: 5, maintainability: 3 }), 12));
test("totalScore of a single-perspective score is that score", () =>
  assert.equal(totalScore({ general: 7 }), 7));

// --- pickBestProposal -------------------------------------------------------
test("pickBestProposal picks the strictly highest total", () => {
  const { winner, winnerScore } = pickBestProposal([
    { id: "A", strategy: "minimal-change", scores: { correctness: 3, security: 3 } },
    { id: "B", strategy: "robustness", scores: { correctness: 5, security: 4 } },
    { id: "C", strategy: "architecture-fit", scores: { correctness: 4, security: 2 } },
  ]);
  assert.equal(winner.id, "B");
  assert.equal(winnerScore, 9);
});
test("pickBestProposal on a single proposal returns that proposal", () => {
  const { winner } = pickBestProposal([{ id: "only", strategy: "direct", scores: { general: 1 } }]);
  assert.equal(winner.id, "only");
});
test("pickBestProposal breaks a tie by picking the first-listed proposal", () => {
  const { winner } = pickBestProposal([
    { id: "first", strategy: "minimal-change", scores: { correctness: 5 } },
    { id: "second", strategy: "robustness", scores: { correctness: 5 } },
  ]);
  assert.equal(winner.id, "first");
});
test("pickBestProposal rejects an empty list rather than guessing", () =>
  assert.throws(() => pickBestProposal([]), /at least one proposal/));

// --- renderSolutionDocument ------------------------------------------------
const THREE_PROPOSALS = [
  {
    id: "P1",
    strategy: "minimal-change",
    scores: { correctness: 3, security: 3 },
    summary: "Smallest possible diff.",
  },
  {
    id: "P2",
    strategy: "robustness",
    scores: { correctness: 5, security: 4 },
    summary: "Handles the edge cases too.",
  },
  {
    id: "P3",
    strategy: "architecture-fit",
    scores: { correctness: 4, security: 2 },
    summary: "Matches the existing module layout.",
  },
];

test("renderSolutionDocument includes the issue number in the title", () =>
  assert.ok(
    renderSolutionDocument({ issueNumber: 76, proposals: THREE_PROPOSALS, winnerId: "P2" }).includes(
      "Issue #76",
    ),
  ));
test("renderSolutionDocument marks exactly the winner as WINNER and the rest as rejected", () => {
  const doc = renderSolutionDocument({ issueNumber: 1, proposals: THREE_PROPOSALS, winnerId: "P2" });
  assert.equal((doc.match(/\*\*WINNER\*\*/g) ?? []).length, 1);
  assert.equal((doc.match(/rejected/g) ?? []).length, 2);
});
test("renderSolutionDocument's rejected section lists every non-winning proposal's id", () => {
  const doc = renderSolutionDocument({ issueNumber: 1, proposals: THREE_PROPOSALS, winnerId: "P2" });
  assert.ok(doc.includes("### P1 (minimal-change)"));
  assert.ok(doc.includes("### P3 (architecture-fit)"));
  assert.ok(!doc.includes("### P2"));
});
test("renderSolutionDocument on a lite-tier single proposal says so instead of an empty rejected section", () => {
  const doc = renderSolutionDocument({
    issueNumber: 2,
    proposals: [{ id: "only", strategy: "direct", scores: { general: 5 }, summary: "The fix." }],
    winnerId: "only",
  });
  assert.ok(doc.includes("only one proposal was in this tier's panel composition"));
});
test("renderSolutionDocument rejects a winnerId that matches no proposal", () =>
  assert.throws(
    () => renderSolutionDocument({ issueNumber: 1, proposals: THREE_PROPOSALS, winnerId: "nope" }),
    /does not match any proposal/,
  ));

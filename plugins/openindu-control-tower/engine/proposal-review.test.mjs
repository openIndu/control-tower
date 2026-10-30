import assert from "node:assert/strict";
import test from "node:test";

import {
  runProposalStage,
  runReviewStage,
  runStep2,
  solidifyPlan,
} from "./proposal-review.mjs";

test("runProposalStage generates exactly 1 proposal for lite, calling generateProposal with the lite strategy", async () => {
  const calls = [];
  const proposals = await runProposalStage(
    { issue: { number: 1 }, tier: "lite" },
    async (strategy, issue) => {
      calls.push({ strategy, issueNumber: issue.number });
      return { summary: `summary for ${strategy}` };
    },
  );
  assert.equal(proposals.length, 1);
  assert.deepEqual(calls, [{ strategy: "direct", issueNumber: 1 }]);
  assert.deepEqual(proposals[0], {
    id: "p1",
    strategy: "direct",
    summary: "summary for direct",
  });
});

test("runProposalStage generates exactly 3 proposals for standard, with the 3 named strategies in order", async () => {
  const proposals = await runProposalStage(
    { issue: { number: 1 }, tier: "standard" },
    async (strategy) => ({ summary: `summary for ${strategy}` }),
  );
  assert.equal(proposals.length, 3);
  assert.deepEqual(
    proposals.map((p) => p.strategy),
    ["minimal-change", "robustness", "architecture-fit"],
  );
  assert.deepEqual(
    proposals.map((p) => p.id),
    ["p1", "p2", "p3"],
  );
});

test("runReviewStage scores each proposal against every planReviewer perspective for the tier", async () => {
  const proposals = [{ id: "p1", strategy: "direct", summary: "s1" }];
  const scoredProposals = await runReviewStage(
    { proposals, tier: "lite" },
    async (perspective) => ({ score: perspective === "general" ? 9 : 0 }),
  );
  assert.deepEqual(scoredProposals[0].scores, { general: 9 });
});

test("runReviewStage for high-risk scores all 5 implementation-review perspectives' plan-stage counterparts", async () => {
  const proposals = [
    { id: "p1", strategy: "minimal-change", summary: "s1" },
    { id: "p2", strategy: "robustness", summary: "s2" },
    { id: "p3", strategy: "architecture-fit", summary: "s3" },
  ];
  let callCount = 0;
  const scoredProposals = await runReviewStage(
    { proposals, tier: "high-risk" },
    async () => {
      callCount++;
      return { score: 1 };
    },
  );
  // 3 proposals x 5 planReviewers (correctness, security, maintainability-architecture,
  // security-challenger, test-challenger) for high-risk.
  assert.equal(callCount, 15);
  assert.equal(Object.keys(scoredProposals[0].scores).length, 5);
});

test("solidifyPlan picks the highest-scoring proposal and renders a document naming it the winner", () => {
  const scoredProposals = [
    {
      id: "p1",
      strategy: "minimal-change",
      summary: "s1",
      scores: { correctness: 5 },
    },
    {
      id: "p2",
      strategy: "robustness",
      summary: "s2",
      scores: { correctness: 9 },
    },
  ];
  const { winner, winnerScore, document } = solidifyPlan({
    issueNumber: 76,
    scoredProposals,
  });
  assert.equal(winner.id, "p2");
  assert.equal(winnerScore, 9);
  assert.match(document, /\*\*p2\*\* \(robustness\)/);
  assert.match(document, /Issue #76/);
});

test("runStep2 ties proposal generation, review, and solidification together end to end for a lite issue", async () => {
  const result = await runStep2(
    { issue: { number: 5, title: "fix typo" }, tier: "lite" },
    {
      generateProposal: async (strategy) => ({
        summary: `plan via ${strategy}`,
      }),
      reviewProposal: async () => ({ score: 7 }),
    },
  );
  assert.equal(result.tier, "lite");
  assert.equal(result.proposals.length, 1);
  assert.equal(result.winner.id, "p1");
  assert.equal(result.winnerScore, 7);
  assert.match(result.document, /Issue #5/);
});

test("runStep2 for standard picks among 3 proposals based on review scores, not generation order", async () => {
  // Make the SECOND strategy (robustness) win on review score, to confirm the
  // winner is picked by score, not by being first- or last-generated.
  const result = await runStep2(
    { issue: { number: 9 }, tier: "standard" },
    {
      generateProposal: async (strategy) => ({
        summary: `plan via ${strategy}`,
      }),
      reviewProposal: async (perspective, proposal) => ({
        score: proposal.strategy === "robustness" ? 10 : 1,
      }),
    },
  );
  assert.equal(result.winner.strategy, "robustness");
});

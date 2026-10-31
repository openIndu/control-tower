import { PANEL_COMPOSITION } from "./review-panel.mjs";
import {
  pickBestProposal,
  renderSolutionDocument,
} from "./plan-solidification.mjs";

// spec/005 section 2.1 step 2 ("N 个独立方案提案 -> 评审打分 -> 仲裁"). generateProposal
// and reviewProposal are both injected -- the real wiring (building a carrier
// invocation per spec/005 section 2.6 and parsing its stream-json result via F1's
// invokeAgent) happens where dev.mjs assembles everything, not here. This module
// owns only the deterministic part: how many proposals and reviewers a tier gets
// (review-panel.mjs, already built), and the scoring/rendering arithmetic
// (plan-solidification.mjs, already built). No LLM call is made directly by this
// file, and no scoring/rendering logic is duplicated from those two modules.
//
// Calls run sequentially, not in parallel. Spec/005's "并行边界" bounds how many
// ISSUES' step 2 may run concurrently (<=3); it says nothing about proposal- or
// reviewer-level parallelism within one issue, so sequential is a documented default
// here, not an assumption -- it keeps cost-capping and ordering simple, and nothing
// in the spec requires more.

export async function runProposalStage({ issue, tier }, generateProposal) {
  const { proposalStrategies } = PANEL_COMPOSITION[tier];
  const proposals = [];
  for (let i = 0; i < proposalStrategies.length; i++) {
    const strategy = proposalStrategies[i];
    const generated = await generateProposal(strategy, issue);
    const proposal = { id: `p${i + 1}`, strategy, summary: generated.summary };
    // guardG4 needs the winner's declaredPaths (carrier-callbacks.mjs's
    // PROPOSAL_SCHEMA). Conditional on presence, same shape as
    // carrier-callbacks.mjs's own costUsd/rawStdout merges, so every
    // pre-existing test here (fakes that return a bare {summary}) keeps its
    // exact-shape assertion unchanged.
    if (generated.declaredPaths !== undefined) {
      proposal.declaredPaths = generated.declaredPaths;
    }
    proposals.push(proposal);
  }
  return proposals;
}

export async function runReviewStage({ proposals, tier }, reviewProposal) {
  const { planReviewers } = PANEL_COMPOSITION[tier];
  const scoredProposals = [];
  for (const proposal of proposals) {
    const scores = {};
    for (const perspective of planReviewers) {
      const { score } = await reviewProposal(perspective, proposal);
      scores[perspective] = score;
    }
    scoredProposals.push({ ...proposal, scores });
  }
  return scoredProposals;
}

export function solidifyPlan({ issueNumber, scoredProposals }) {
  const { winner, winnerScore } = pickBestProposal(scoredProposals);
  const document = renderSolutionDocument({
    issueNumber,
    proposals: scoredProposals,
    winnerId: winner.id,
  });
  return { winner, winnerScore, document };
}

// The full step-2 pipeline for one issue: propose, review, solidify. tier must
// already be resolved (review-panel.mjs's baselineTier + applyLlmTierSignal) before
// calling this -- tier selection is a separate, earlier decision, not repeated here.
export async function runStep2(
  { issue, tier },
  { generateProposal, reviewProposal },
) {
  const proposals = await runProposalStage({ issue, tier }, generateProposal);
  const scoredProposals = await runReviewStage(
    { proposals, tier },
    reviewProposal,
  );
  const { winner, winnerScore, document } = solidifyPlan({
    issueNumber: issue.number,
    scoredProposals,
  });
  return { tier, proposals: scoredProposals, winner, winnerScore, document };
}

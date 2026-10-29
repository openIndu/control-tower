// spec/005 step 2 ("逐个 issue 多 agent 评审，选最优方案并固化"): N
// independent proposals are each scored by the review panel (the headless
// `claude -p` REASON side, structured output per reviewer perspective).
// This module takes those scores and picks the winner in deterministic
// code -- RULE 3: the LLM proposes and reviews, code does the arithmetic --
// and renders the issue-<n>-solution.md file step 2 says to produce,
// including the rejected proposals and the score table.
//
// A scored proposal has the shape:
//   { id, strategy, scores: { <reviewerPerspective>: number }, summary }
// Each reviewer's score is assumed to already be on a common scale, set by
// the REASON-side structured-output schema; this module only sums and
// compares, it does not validate or clamp the scale itself.

export function totalScore(scores) {
  return Object.values(scores).reduce((sum, s) => sum + s, 0);
}

// Highest total score wins. Spec/005 does not name a tie-break rule, so
// "first-listed proposal wins a tie" is a documented default, not an
// assumption smuggled in silently. A real tie across >=3 independent
// reviewer perspectives should be rare; if the runner hits this often
// enough to matter in practice, that itself is worth surfacing rather than
// quietly living with this default forever.
export function pickBestProposal(proposals) {
  if (!Array.isArray(proposals) || proposals.length === 0) {
    throw new Error("pickBestProposal requires at least one proposal");
  }
  let winnerIndex = 0;
  let winnerScore = totalScore(proposals[0].scores);
  for (let i = 1; i < proposals.length; i++) {
    const score = totalScore(proposals[i].scores);
    if (score > winnerScore) {
      winnerIndex = i;
      winnerScore = score;
    }
  }
  return { winner: proposals[winnerIndex], winnerScore };
}

function scoreTableRow(proposal, totals, isWinner) {
  const perspectives = Object.keys(proposal.scores);
  const cells = perspectives.map((p) => String(proposal.scores[p]));
  const marker = isWinner ? "**WINNER**" : "rejected";
  return `| ${proposal.id} (${proposal.strategy}) | ${cells.join(" | ")} | ${totals} | ${marker} |`;
}

export function renderSolutionDocument({ issueNumber, proposals, winnerId }) {
  if (!Array.isArray(proposals) || proposals.length === 0) {
    throw new Error("renderSolutionDocument requires at least one proposal");
  }
  const perspectives = Object.keys(proposals[0].scores);
  const header = `| Proposal | ${perspectives.join(" | ")} | Total | Result |`;
  const separator = `| --- | ${perspectives.map(() => "---").join(" | ")} | --- | --- |`;
  const rows = proposals.map((p) => scoreTableRow(p, totalScore(p.scores), p.id === winnerId));
  const winner = proposals.find((p) => p.id === winnerId);
  if (!winner) {
    throw new Error(`winnerId ${JSON.stringify(winnerId)} does not match any proposal`);
  }

  const lines = [
    `# Issue #${issueNumber} — solution`,
    "",
    "## Score table",
    "",
    header,
    separator,
    ...rows,
    "",
    "## Selected proposal",
    "",
    `**${winner.id}** (${winner.strategy})`,
    "",
    winner.summary,
    "",
    "## Rejected proposals",
    "",
  ];
  const rejected = proposals.filter((p) => p.id !== winnerId);
  if (rejected.length === 0) {
    lines.push("None -- only one proposal was in this tier's panel composition.");
  } else {
    for (const p of rejected) {
      lines.push(`### ${p.id} (${p.strategy})`, "", p.summary, "");
    }
  }
  return lines.join("\n");
}

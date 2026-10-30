import { execFileSync } from "node:child_process";

import { PANEL_COMPOSITION } from "./review-panel.mjs";

const MAX_REVIEW_FIX_ROUNDS = 2;

// spec/005 section 2.1 step 3: "本地确定性门禁（格式 / lint / 测试）先于评审" -- local
// gates gate whether a review even happens, they are not reviewed themselves. commands
// are plain shell strings; which commands a repo actually needs is route/repo-specific
// data this module does not own (no dev.schema.json field for this exists yet -- the
// caller sources the list, this function only runs whatever list it's given).
export function runLocalGates(commands, execShell = defaultExecShell) {
  const results = commands.map((command) => {
    const { status, output } = execShell(command);
    return { command, pass: status === 0, output };
  });
  return { pass: results.every((r) => r.pass), results };
}

function defaultExecShell(command) {
  try {
    const output = execFileSync(command, { shell: true, encoding: "utf8" });
    return { status: 0, output };
  } catch (error) {
    return {
      status: error.status ?? 1,
      output: (error.stdout ?? "") + (error.stderr ?? ""),
    };
  }
}

function renderReviewDocument({ issueNumber, rounds }) {
  const lines = [`# Issue #${issueNumber} — implementation review`, ""];
  rounds.forEach((round, i) => {
    lines.push(`## Round ${i + 1}`, "");
    for (const [perspective, mustFixItems] of Object.entries(round.findings)) {
      lines.push(
        `**${perspective}**: ${mustFixItems.length === 0 ? "no must-fix findings" : mustFixItems.join("; ")}`,
      );
    }
    lines.push("");
  });
  return lines.join("\n");
}

// spec/005 section 2.1 step 3: implement once, then review+fix for up to
// MAX_REVIEW_FIX_ROUNDS rounds ("评审与修复各最多 2 轮，超出 -> BLOCKED"). implement,
// review and fix are all injected -- same pattern as F3's proposal-review.mjs, the
// real carrier-invocation wiring is assembled when dev.mjs is written.
export async function runStep3(
  { issue, tier, winningProposal, localGateCommands },
  { implement, review, fix, execShell = defaultExecShell },
) {
  await implement(winningProposal, issue);
  const { implReviewers } = PANEL_COMPOSITION[tier];
  const rounds = [];

  for (let round = 0; round < MAX_REVIEW_FIX_ROUNDS; round++) {
    const gateResult = runLocalGates(localGateCommands, execShell);
    if (!gateResult.pass) {
      await fix({ reason: "local-gate-failure", gateResult }, issue);
      rounds.push({
        findings: { "local-gates": ["local gate(s) failed, fix attempted"] },
      });
      continue;
    }

    const findings = {};
    for (const perspective of implReviewers) {
      const { mustFixItems } = await review(perspective, issue);
      findings[perspective] = mustFixItems;
    }
    rounds.push({ findings });

    const allMustFix = Object.values(findings).flat();
    if (allMustFix.length === 0) {
      return {
        outcome: "approved",
        rounds: rounds.length,
        document: renderReviewDocument({ issueNumber: issue.number, rounds }),
      };
    }
    await fix({ reason: "review-must-fix", mustFixItems: allMustFix }, issue);
  }

  return {
    outcome: "BLOCKED",
    rounds: rounds.length,
    document: renderReviewDocument({ issueNumber: issue.number, rounds }),
  };
}

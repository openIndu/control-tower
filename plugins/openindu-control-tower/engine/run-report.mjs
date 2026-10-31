import { detectRevertOfRecordedMerge } from "./circuit-breaker.mjs";
import { isClean, needsHuman } from "./states.mjs";

// spec/005 section 6 criterion #16: the run report must include a
// degradation rate, a human-correction rate, and a rollback rate. Reuses
// states.mjs's own classifiers rather than re-deriving a second state
// grouping -- "degraded" is simply "not clean" in that module's vocabulary
// (BLOCKED/FAILED fold into degradation here too; the spec names only these
// three rates, not a fourth "failure rate" alongside them).
//
// issueOutcomes: [{issueNumber, state}], one per issue this run reached a
// terminal state for (NO_ACTION/excluded issues should not be included --
// they were never actually attempted).
export function computeOutcomeRates(issueOutcomes) {
  const total = issueOutcomes.length;
  if (total === 0) {
    return { degradationRate: 0, humanCorrectionRate: 0, total: 0 };
  }
  const degraded = issueOutcomes.filter((o) => !isClean(o.state)).length;
  const humanRequired = issueOutcomes.filter((o) => needsHuman(o.state)).length;
  return {
    degradationRate: degraded / total,
    humanCorrectionRate: humanRequired / total,
    total,
  };
}

// recordedMerges: [{issueNumber, mergeSha}], one per issue this run actually
// merged (run-state.mjs's markMerged records mergeSha). commitMessages: the
// default branch's post-run commit log -- a fresh read, same pattern
// step4-callbacks.mjs's internalFacts already uses for circuit-breaker
// facts, not something cached from before the run's own merges happened.
export function computeRollbackRate(recordedMerges, commitMessages) {
  if (recordedMerges.length === 0) {
    return { rollbackRate: 0, reverted: [] };
  }
  const recordedShas = recordedMerges.map((m) => m.mergeSha);
  const detected = detectRevertOfRecordedMerge(commitMessages, recordedShas);
  const revertedShas = new Set(detected.map((d) => d.sha));
  const reverted = recordedMerges.filter((m) => revertedShas.has(m.mergeSha));
  return {
    rollbackRate: reverted.length / recordedMerges.length,
    reverted,
  };
}

// spec/005 section 6 criterion #15's matrix needs a CI column distinct from
// PR/合并读回, but pr-and-merge.mjs's runStep4 does not carry an explicit
// ciGreen flag on its return value -- this derives it from fields that ARE
// always present, verified against all of runStep4's actual return shapes
// (read directly, not guessed): MERGED/PR_GREEN/FAILED can only be reached
// after CI went green (FAILED is the post-merge readback mismatch, which
// requires having already called merge()); a HUMAN_MERGE_REQUIRED carrying
// `failures` only happens after a promotion guard ran, itself gated on CI
// already being green; a HUMAN_MERGE_REQUIRED carrying `reason` and no
// `failures` is the one shape that means CI itself never went green.
export function classifyCiForReport(result) {
  if (!result.prNumber) return "N/A";
  if (result.state === "HUMAN_MERGE_REQUIRED" && !result.failures) {
    return "not green";
  }
  return "green";
}

function renderDocColumn(value) {
  return value ? "✓" : "—";
}

function renderStateColumn(result) {
  if (result.state) return result.state;
  return result.dryRun ? "DRY_RUN" : "UNKNOWN";
}

// localServiceResult: local-service.mjs's step-5 outcome for this run (see
// dev.mjs's wiring) -- shapes are {attempted: false, reason} when
// dev.local_service is not configured, {attempted: true, healthy,
// blockedByProductionCheck, error} when startLocalService/probeHealth threw
// (checkNotPointingAtProduction's refusal gets its own line, since that is a
// safety refusal rather than an ordinary failure), or {attempted: true,
// healthy, pid, checklistPath} on a normal attempt.
function renderLocalVerificationSection(localServiceResult) {
  const lines = ["## Local verification", ""];
  if (!localServiceResult.attempted) {
    lines.push(`- Not attempted: ${localServiceResult.reason}`);
    return lines.join("\n");
  }
  if (localServiceResult.blockedByProductionCheck) {
    lines.push(`- Refused to start: ${localServiceResult.error}`);
    return lines.join("\n");
  }
  if (localServiceResult.error) {
    lines.push(`- Failed: ${localServiceResult.error}`);
    return lines.join("\n");
  }
  lines.push(
    `- Healthy: ${localServiceResult.healthy ? "yes" : "no"}`,
    `- Verify checklist: ${localServiceResult.checklistPath ?? "none (no issue in this run reached MERGED)"}`,
  );
  return lines.join("\n");
}

// issueResults: runIssuePipeline's return shape, one per issue a run
// attempted (dry-run or real) -- NOT issues skipped entirely (excluded by
// --max-issues, or never reached because the budget tripped first). Renders
// spec/005 section 6 criterion #15's matrix (方案/评审/PR/CI/合并读回/状态)
// plus criterion #16's three rates, as markdown. rule11Checklist is
// renderRule11StatusChecklist's (build-step.mjs) already-rendered text, or
// null when step 6 readiness was not computed for this run (e.g. the repo
// has no dev.build at all) -- omitted from the report rather than printed
// as a misleading empty section. localServiceResult is step 5's outcome
// (see renderLocalVerificationSection above), or null when it was not
// computed for this run (e.g. a dry run, which never reaches step 5) --
// also omitted rather than printed empty.
//
// "已合并" (per issue, the 状态 column reading MERGED) is deliberately a
// different claim from the top-level Complete/Partially complete verdict
// below -- AGENTS.md's own completion-report rule (never report a whole-
// task "done" unless every row passed read-back) applies to this runner's
// own report exactly as it applies to this assistant's chat replies, so
// Complete requires every attempted issue to be clean, not just merged.
export function renderRunReport({
  issueResults,
  outcomeRates,
  rollbackRate,
  rule11Checklist = null,
  localServiceResult = null,
}) {
  const lines = [
    "# /dev run report",
    "",
    "| Issue | 方案 | 评审 | PR | CI | 合并读回 | 状态 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const result of issueResults) {
    lines.push(
      `| #${result.issueNumber} | ${renderDocColumn(result.solutionDocument)} | ${renderDocColumn(
        result.implementationReviewDocument,
      )} | ${result.prNumber ?? "—"} | ${classifyCiForReport(result)} | ${
        result.state === "MERGED" ? result.mergeCommit : "N/A"
      } | ${renderStateColumn(result)} |`,
    );
  }

  lines.push(
    "",
    "## Rates",
    "",
    `- Degradation rate: ${(outcomeRates.degradationRate * 100).toFixed(1)}% (${outcomeRates.total} issue(s))`,
    `- Human-correction rate: ${(outcomeRates.humanCorrectionRate * 100).toFixed(1)}%`,
    `- Rollback rate: ${(rollbackRate.rollbackRate * 100).toFixed(1)}%`,
  );

  if (localServiceResult) {
    lines.push("", renderLocalVerificationSection(localServiceResult));
  }

  if (rule11Checklist) {
    lines.push("", "## RULE 11 delivery status", "", rule11Checklist);
  }

  const isComplete =
    outcomeRates.degradationRate === 0 &&
    outcomeRates.humanCorrectionRate === 0;
  lines.push(
    "",
    isComplete
      ? "Complete: every attempted issue reached a clean terminal state."
      : `Partially complete: ${Math.round(outcomeRates.degradationRate * outcomeRates.total)} issue(s) did not reach a clean terminal state -- see the 状态 column above.`,
  );

  return lines.join("\n");
}

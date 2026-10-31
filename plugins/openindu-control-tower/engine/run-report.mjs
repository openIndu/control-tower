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

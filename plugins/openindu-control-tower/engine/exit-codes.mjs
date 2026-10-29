import { isClean, isTerminalState } from "./states.mjs";

// Runner exit codes (spec/005 section 2.4). Mirrors reference/dev.schema.json's
// $defs.exitCode enum and descriptions.
export const EXIT_CODES = Object.freeze({
  OK: 0,
  ARGUMENT_OR_INTERNAL_ERROR: 1,
  PARTIAL: 2,
  REJECTED: 3,
  CIRCUIT_BREAKER: 4,
  ENVIRONMENT_CHECK_FAILED: 5,
});

// Codes 1/3/4/5 are whole-run short-circuits decided before any issue is
// processed (bad arguments, an excluded repo, a tripped breaker, a failed
// environment check) — they never come from a batch of issue outcomes, so
// there is nothing to derive them from here.
//
// Only OK and PARTIAL are actually selected from a finished batch: every
// issue ending clean (MERGED/PR_GREEN/NO_ACTION) is OK; any BLOCKED/FAILED/
// HUMAN_* issue makes the whole run PARTIAL.
export function exitCodeForStates(states) {
  for (const state of states) {
    if (!isTerminalState(state)) {
      throw new Error(`Not a terminal state: ${JSON.stringify(state)}`);
    }
  }
  const allClean = states.every((state) => isClean(state));
  return allClean ? EXIT_CODES.OK : EXIT_CODES.PARTIAL;
}

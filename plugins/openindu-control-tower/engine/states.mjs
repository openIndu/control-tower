// Terminal states for a single issue processed by /dev (spec/005 section 2.4).
// Mirrors reference/dev.schema.json's $defs.issueTerminalState enum and descriptions —
// that file is the documented source; this is the runtime-checkable form of the same set.
export const TERMINAL_STATES = Object.freeze([
  "MERGED",
  "PR_GREEN",
  "HUMAN_MERGE_REQUIRED",
  "HUMAN_REQUIRED",
  "NEEDS_TRIAGE",
  "NO_ACTION",
  "BLOCKED",
  "FAILED",
]);

const TERMINAL_STATE_SET = new Set(TERMINAL_STATES);

// States reached without a bug and without handing a decision to a human.
const CLEAN_STATES = new Set(["MERGED", "PR_GREEN", "NO_ACTION"]);

// States that stop to let a human decide, rather than reporting an internal failure.
const HUMAN_STATES = new Set([
  "HUMAN_MERGE_REQUIRED",
  "HUMAN_REQUIRED",
  "NEEDS_TRIAGE",
]);

export function isTerminalState(value) {
  return TERMINAL_STATE_SET.has(value);
}

function assertTerminalState(value) {
  if (!isTerminalState(value)) {
    throw new Error(`Not a terminal state: ${JSON.stringify(value)}`);
  }
}

export function isClean(state) {
  assertTerminalState(state);
  return CLEAN_STATES.has(state);
}

export function needsHuman(state) {
  assertTerminalState(state);
  return HUMAN_STATES.has(state);
}

export function isFailureLike(state) {
  assertTerminalState(state);
  return state === "BLOCKED" || state === "FAILED";
}

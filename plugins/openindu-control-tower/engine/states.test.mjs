import assert from "node:assert/strict";
import test from "node:test";

import {
  TERMINAL_STATES,
  isClean,
  isFailureLike,
  isTerminalState,
  needsHuman,
} from "./states.mjs";

test("accepts all 8 documented terminal states", () => {
  for (const state of TERMINAL_STATES) assert.equal(isTerminalState(state), true);
  assert.equal(TERMINAL_STATES.length, 8);
});
test("rejects a string that is not a terminal state", () =>
  assert.equal(isTerminalState("IN_PROGRESS"), false));
test("rejects undefined and null", () => {
  assert.equal(isTerminalState(undefined), false);
  assert.equal(isTerminalState(null), false);
});

test("MERGED, PR_GREEN and NO_ACTION are clean", () => {
  assert.equal(isClean("MERGED"), true);
  assert.equal(isClean("PR_GREEN"), true);
  assert.equal(isClean("NO_ACTION"), true);
});
test("HUMAN_MERGE_REQUIRED, HUMAN_REQUIRED and NEEDS_TRIAGE need a human, and are not clean", () => {
  for (const state of ["HUMAN_MERGE_REQUIRED", "HUMAN_REQUIRED", "NEEDS_TRIAGE"]) {
    assert.equal(needsHuman(state), true);
    assert.equal(isClean(state), false);
  }
});
test("BLOCKED and FAILED are failure-like, and are neither clean nor human-needed", () => {
  for (const state of ["BLOCKED", "FAILED"]) {
    assert.equal(isFailureLike(state), true);
    assert.equal(isClean(state), false);
    assert.equal(needsHuman(state), false);
  }
});
test("every terminal state falls into exactly one of clean / needs-human / failure-like", () => {
  for (const state of TERMINAL_STATES) {
    const buckets = [isClean(state), needsHuman(state), isFailureLike(state)];
    assert.equal(
      buckets.filter(Boolean).length,
      1,
      `${state} must land in exactly one category, got ${JSON.stringify(buckets)}`,
    );
  }
});
test("isClean rejects a non-terminal value instead of silently returning false", () =>
  assert.throws(() => isClean("MERGING"), /Not a terminal state/));
test("needsHuman rejects a non-terminal value instead of silently returning false", () =>
  assert.throws(() => needsHuman("MERGING"), /Not a terminal state/));
test("isFailureLike rejects a non-terminal value instead of silently returning false", () =>
  assert.throws(() => isFailureLike("MERGING"), /Not a terminal state/));

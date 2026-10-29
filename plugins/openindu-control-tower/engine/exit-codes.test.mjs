import assert from "node:assert/strict";
import test from "node:test";

import { EXIT_CODES, exitCodeForStates } from "./exit-codes.mjs";

test("exit codes match spec/005 section 2.4's exact numbering", () =>
  assert.deepEqual(EXIT_CODES, {
    OK: 0,
    ARGUMENT_OR_INTERNAL_ERROR: 1,
    PARTIAL: 2,
    REJECTED: 3,
    CIRCUIT_BREAKER: 4,
    ENVIRONMENT_CHECK_FAILED: 5,
  }));

test("an empty batch is OK (vacuously, nothing failed)", () =>
  assert.equal(exitCodeForStates([]), EXIT_CODES.OK));
test("an all-clean batch is OK", () =>
  assert.equal(
    exitCodeForStates(["MERGED", "PR_GREEN", "NO_ACTION"]),
    EXIT_CODES.OK,
  ));
test("one HUMAN_MERGE_REQUIRED among clean states makes the batch PARTIAL", () =>
  assert.equal(
    exitCodeForStates(["MERGED", "HUMAN_MERGE_REQUIRED", "NO_ACTION"]),
    EXIT_CODES.PARTIAL,
  ));
test("one HUMAN_REQUIRED makes the batch PARTIAL", () =>
  assert.equal(exitCodeForStates(["HUMAN_REQUIRED"]), EXIT_CODES.PARTIAL));
test("one NEEDS_TRIAGE makes the batch PARTIAL", () =>
  assert.equal(exitCodeForStates(["NEEDS_TRIAGE"]), EXIT_CODES.PARTIAL));
test("one BLOCKED makes the batch PARTIAL", () =>
  assert.equal(exitCodeForStates(["BLOCKED"]), EXIT_CODES.PARTIAL));
test("one FAILED makes the batch PARTIAL", () =>
  assert.equal(exitCodeForStates(["FAILED"]), EXIT_CODES.PARTIAL));
test("rejects a batch containing a non-terminal value", () =>
  assert.throws(() => exitCodeForStates(["MERGED", "PENDING"]), /Not a terminal state/));

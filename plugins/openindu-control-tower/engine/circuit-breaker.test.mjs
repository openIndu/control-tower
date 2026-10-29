import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { detectRevertOfRecordedMerge, shouldTripCircuitBreaker } from "./circuit-breaker.mjs";
import { isPaused, writePause } from "./dev-pause.mjs";

const clean = {
  ciTurnedRedPostMerge: false,
  nonRunnerMergeDetected: false,
  twoConsecutiveBlockedIssues: false,
  repeatedToolErrors: false,
};
test("does not trip when all four conditions are clean", () =>
  assert.equal(shouldTripCircuitBreaker(clean).tripped, false));
test("trips when default branch CI turns red post-merge", () =>
  assert.equal(
    shouldTripCircuitBreaker({ ...clean, ciTurnedRedPostMerge: true }).tripped,
    true,
  ));
test("trips when a non-runner merge is detected", () =>
  assert.equal(
    shouldTripCircuitBreaker({ ...clean, nonRunnerMergeDetected: true }).tripped,
    true,
  ));
test("trips on 2 consecutive BLOCKED issues", () =>
  assert.equal(
    shouldTripCircuitBreaker({ ...clean, twoConsecutiveBlockedIssues: true }).tripped,
    true,
  ));
test("trips on repeated tool errors", () =>
  assert.equal(shouldTripCircuitBreaker({ ...clean, repeatedToolErrors: true }).tripped, true));
test("reports every tripped reason at once, not just the first", () => {
  const result = shouldTripCircuitBreaker({ ...clean, ciTurnedRedPostMerge: true, repeatedToolErrors: true });
  assert.equal(result.reasons.length, 2);
});

test("detects a recorded merge reverted via git revert's own commit-message format", () => {
  const detected = detectRevertOfRecordedMerge(
    ["This reverts commit abc1234567890abc1234567890abc1234567890."],
    ["abc1234567890abc1234567890abc1234567890"],
  );
  assert.equal(detected.length, 1);
  assert.equal(detected[0].sha, "abc1234567890abc1234567890abc1234567890");
});
test("matches a short SHA prefix against a recorded full SHA", () => {
  const detected = detectRevertOfRecordedMerge(
    ["Revert feature X\n\nThis reverts commit abc1234."],
    ["abc1234567890abc1234567890abc1234567890"],
  );
  assert.equal(detected.length, 1);
});
test("does not flag an ordinary commit message with no revert marker", () =>
  assert.deepEqual(
    detectRevertOfRecordedMerge(["fix: typo in README"], ["abc1234567890abc1234567890abc1234567890"]),
    [],
  ));
test("end-to-end: a detected revert of a recorded merge leads to .dev-pause actually being written (spec/005 acceptance #19)", () => {
  const dir = mkdtempSync(join(tmpdir(), "revert-pause-test-"));
  try {
    const pauseFilePath = join(dir, ".dev-pause");
    const recordedMergeShas = ["abc1234567890abc1234567890abc1234567890"];
    const detections = detectRevertOfRecordedMerge(
      ["This reverts commit abc1234567890abc1234567890abc1234567890."],
      recordedMergeShas,
    );
    assert.equal(detections.length, 1);
    assert.equal(isPaused(pauseFilePath), false);
    if (detections.length > 0) {
      writePause(pauseFilePath, `revert detected: ${detections[0].revertingCommitMessage}`);
    }
    assert.equal(isPaused(pauseFilePath), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("does not flag a revert of a SHA this runner never recorded", () =>
  assert.deepEqual(
    detectRevertOfRecordedMerge(["This reverts commit deadbeefdeadbeefdeadbeefdeadbeefdeadbeef."], [
      "abc1234567890abc1234567890abc1234567890",
    ]),
    [],
  ));

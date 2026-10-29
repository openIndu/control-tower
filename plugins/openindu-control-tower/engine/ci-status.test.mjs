import assert from "node:assert/strict";
import test from "node:test";

import { allRequiredChecksGreen, isCheckGreen } from "./ci-status.mjs";

test("SUCCESS is green", () => assert.equal(isCheckGreen("SUCCESS"), true));
for (const conclusion of [
  "PENDING",
  "CANCELLED",
  "NEUTRAL",
  "ACTION_REQUIRED",
  "SKIPPED",
  "FAILURE",
  "TIMED_OUT",
  "STALE",
  null,
  undefined,
]) {
  test(`${conclusion} is not green`, () => assert.equal(isCheckGreen(conclusion), false));
}

test("all required checks green when every one is SUCCESS", () => {
  const result = allRequiredChecksGreen(
    ["test", "secret-scan"],
    [
      { name: "test", conclusion: "SUCCESS" },
      { name: "secret-scan", conclusion: "SUCCESS" },
      { name: "lint", conclusion: "FAILURE" },
    ],
  );
  assert.deepEqual(result, { allGreen: true, missing: [] });
});
test("a required check that ran but did not succeed is reported missing", () => {
  const result = allRequiredChecksGreen(
    ["test"],
    [{ name: "test", conclusion: "PENDING" }],
  );
  assert.deepEqual(result, { allGreen: false, missing: ["test"] });
});
test("a required check that never ran at all (path-filtered out) is reported missing, same as one that failed", () => {
  const result = allRequiredChecksGreen(["secret-scan"], []);
  assert.deepEqual(result, { allGreen: false, missing: ["secret-scan"] });
});

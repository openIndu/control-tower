import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMISSION_RESULTS,
  admissionA1,
  admissionA2,
  admissionA3,
  evaluateAdmission,
} from "./admission.mjs";

test("A1 passes when the default branch has a CI workflow", () =>
  assert.equal(admissionA1(true).pass, true));
test("A1 fails when there is no CI workflow at all", () =>
  assert.equal(admissionA1(false).pass, false));

test("A2 fails with no required checks declared", () =>
  assert.equal(admissionA2(null).pass, false));
test("A2 fails with an empty required-checks array", () =>
  assert.equal(admissionA2([]).pass, false));
test("A2 fails when secret-scan is missing from the declared kinds", () =>
  assert.equal(admissionA2([{ name: "unit", kind: "test" }]).pass, false));
test("A2 fails when test is missing from the declared kinds", () =>
  assert.equal(
    admissionA2([{ name: "gitleaks", kind: "secret-scan" }]).pass,
    false,
  ));
test("A2 passes once both test and secret-scan are declared", () =>
  assert.equal(
    admissionA2([
      { name: "unit", kind: "test" },
      { name: "gitleaks", kind: "secret-scan" },
      { name: "lint", kind: "lint" },
    ]).pass,
    true,
  ));

test("A3 fails when the default branch HEAD CI is pending", () =>
  assert.equal(admissionA3("PENDING").pass, false));
test("A3 fails when the default branch HEAD CI failed", () =>
  assert.equal(admissionA3("FAILURE").pass, false));
test("A3 passes when the default branch HEAD CI is SUCCESS", () =>
  assert.equal(admissionA3("SUCCESS").pass, true));

const requiredChecks = [
  { name: "unit", kind: "test" },
  { name: "gitleaks", kind: "secret-scan" },
];

test("evaluateAdmission rejects outright when A1 fails, regardless of A2/A3", () => {
  const verdict = evaluateAdmission({
    hasDefaultBranchCiWorkflow: false,
    requiredChecks,
    defaultBranchHeadCiState: "SUCCESS",
  });
  assert.equal(verdict.result, ADMISSION_RESULTS.REJECTED);
  assert.equal(verdict.reasons.length, 1);
});
test("evaluateAdmission is PR_ONLY when A1 passes but A2 fails", () => {
  const verdict = evaluateAdmission({
    hasDefaultBranchCiWorkflow: true,
    requiredChecks: [],
    defaultBranchHeadCiState: "SUCCESS",
  });
  assert.equal(verdict.result, ADMISSION_RESULTS.PR_ONLY);
});
test("evaluateAdmission is PR_ONLY when A1 passes but A3 fails", () => {
  const verdict = evaluateAdmission({
    hasDefaultBranchCiWorkflow: true,
    requiredChecks,
    defaultBranchHeadCiState: "FAILURE",
  });
  assert.equal(verdict.result, ADMISSION_RESULTS.PR_ONLY);
});
test("evaluateAdmission reports both A2 and A3 reasons when both fail", () => {
  const verdict = evaluateAdmission({
    hasDefaultBranchCiWorkflow: true,
    requiredChecks: [],
    defaultBranchHeadCiState: "FAILURE",
  });
  assert.equal(verdict.result, ADMISSION_RESULTS.PR_ONLY);
  assert.equal(verdict.reasons.length, 2);
});
test("evaluateAdmission is FULL only when A1-A3 all pass", () => {
  const verdict = evaluateAdmission({
    hasDefaultBranchCiWorkflow: true,
    requiredChecks,
    defaultBranchHeadCiState: "SUCCESS",
  });
  assert.deepEqual(verdict, { result: ADMISSION_RESULTS.FULL, reasons: [] });
});

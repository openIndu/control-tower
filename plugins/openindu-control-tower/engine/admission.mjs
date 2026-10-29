// Runtime admission guards A1-A3 (spec/005 section 2.3-2, point 3). These
// gate a repo's whole run independently of any grant: A1 can forbid writing
// anything at all; A2/A3 force PR-only regardless of what the merge guards
// (G1-G11) would otherwise decide.
export const ADMISSION_RESULTS = Object.freeze({
  REJECTED: "rejected",
  PR_ONLY: "pr_only",
  FULL: "full",
});

const REQUIRED_KINDS = ["test", "secret-scan"];

// A1: no CI workflow on the default branch at all -> refuse to run (exit 3).
// Never open a PR, never deploy a write-capable agent on a repo with no CI.
export function admissionA1(hasDefaultBranchCiWorkflow) {
  if (!hasDefaultBranchCiWorkflow) {
    return { pass: false, reason: "no CI workflow on the default branch (A1)" };
  }
  return { pass: true };
}

// A2: no human-declared dev.required_checks, or the set is missing a
// required kind (test, secret-scan) -> PR-only.
export function admissionA2(requiredChecks) {
  const kinds = new Set((requiredChecks ?? []).map((check) => check.kind));
  const missing = REQUIRED_KINDS.filter((kind) => !kinds.has(kind));
  if (!requiredChecks || requiredChecks.length === 0 || missing.length > 0) {
    return {
      pass: false,
      reason:
        !requiredChecks || requiredChecks.length === 0
          ? "no dev.required_checks declared (A2)"
          : `dev.required_checks missing kind(s): ${missing.join(", ")} (A2)`,
    };
  }
  return { pass: true };
}

// A3: the default branch's current HEAD CI is not SUCCESS -> PR-only.
export function admissionA3(defaultBranchHeadCiState) {
  if (defaultBranchHeadCiState !== "SUCCESS") {
    return {
      pass: false,
      reason: `default branch HEAD CI is ${defaultBranchHeadCiState}, not SUCCESS (A3)`,
    };
  }
  return { pass: true };
}

// Combine A1-A3 into one verdict for the run. A1 failing short-circuits
// (REJECTED); A2/A3 failing independently force PR_ONLY, but both reasons
// are reported together rather than only the first one found.
export function evaluateAdmission({
  hasDefaultBranchCiWorkflow,
  requiredChecks,
  defaultBranchHeadCiState,
}) {
  const a1 = admissionA1(hasDefaultBranchCiWorkflow);
  if (!a1.pass) {
    return { result: ADMISSION_RESULTS.REJECTED, reasons: [a1.reason] };
  }
  const reasons = [admissionA2(requiredChecks), admissionA3(defaultBranchHeadCiState)]
    .filter((check) => !check.pass)
    .map((check) => check.reason);
  if (reasons.length > 0) {
    return { result: ADMISSION_RESULTS.PR_ONLY, reasons };
  }
  return { result: ADMISSION_RESULTS.FULL, reasons: [] };
}

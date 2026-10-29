// CI status classification, shared by guards G2 and G8 (spec/005 section
// 2.3-3). Only SUCCESS counts as green -- pending, cancelled, neutral,
// action_required and skipped are all "not green", and a required check
// that never ran at all (e.g. path-filtered out) is treated the same as one
// that ran and failed: still missing, not a pass by omission.
export function isCheckGreen(conclusion) {
  return conclusion === "SUCCESS";
}

// requiredNames: the required check-name set (human-declared dev.required_checks
// union branch-protection-required names -- the union itself is the caller's job,
// this just evaluates a flat set against what actually ran).
// actualChecks: [{name, conclusion}], as reported for one specific SHA.
export function allRequiredChecksGreen(requiredNames, actualChecks) {
  const byName = new Map(actualChecks.map((check) => [check.name, check.conclusion]));
  const missing = requiredNames.filter((name) => !isCheckGreen(byName.get(name)));
  return { allGreen: missing.length === 0, missing };
}

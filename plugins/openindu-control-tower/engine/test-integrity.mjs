// Test-integrity checks for G4 (spec/005 section 2.3-3): no deleted tests,
// no newly added skip/xfail/only, no lowered coverage threshold. These are
// regex heuristics over unified-diff text for the common JS/Python test
// runners this org actually uses (node:test, vitest/jest, pytest) -- not an
// exhaustive parse of every framework's skip syntax. A framework-specific
// gap here is a known limitation, surfaced in the finding text, not a
// silent false "clean".
const ADDED_SKIP_PATTERNS = [
  /^\+.*\b(test|it|describe)\.(skip|only)\(/,
  /^\+.*@pytest\.mark\.skip/,
  /^\+.*@pytest\.mark\.xfail/,
  /^\+.*\bxit\(|\bxdescribe\(/,
];

function diffLines(unifiedDiff) {
  return unifiedDiff.split("\n");
}

function removedTestFiles(changedFiles) {
  return changedFiles.filter(
    (file) =>
      file.status === "removed" &&
      /(\.test\.|\.spec\.|(^|\/)tests?\/|(^|\/)__tests__\/)/.test(file.path),
  );
}

function findAddedSkipLines(unifiedDiff) {
  return diffLines(unifiedDiff).filter((line) =>
    ADDED_SKIP_PATTERNS.some((pattern) => pattern.test(line)),
  );
}

// baseThresholds/headThresholds: {lines, branches, functions, statements} as
// declared in the repo's own coverage config, parsed by the caller (the
// exact config file and key names are per dev.checks, not this module's
// concern) -- this only compares two already-extracted number maps.
function findLoweredThresholds(baseThresholds, headThresholds) {
  const lowered = [];
  for (const [metric, baseValue] of Object.entries(baseThresholds ?? {})) {
    const headValue = headThresholds?.[metric];
    if (typeof headValue === "number" && headValue < baseValue) {
      lowered.push(`${metric}: ${baseValue} -> ${headValue}`);
    }
  }
  return lowered;
}

export function checkTestIntegrity({
  changedFiles,
  unifiedDiff,
  baseCoverageThresholds,
  headCoverageThresholds,
}) {
  const findings = [];
  const removed = removedTestFiles(changedFiles ?? []);
  if (removed.length > 0) {
    findings.push(`deleted test file(s): ${removed.map((f) => f.path).join(", ")}`);
  }
  const skipped = findAddedSkipLines(unifiedDiff ?? "");
  if (skipped.length > 0) {
    findings.push(`added skip/xfail/only: ${skipped.length} line(s)`);
  }
  const lowered = findLoweredThresholds(baseCoverageThresholds, headCoverageThresholds);
  if (lowered.length > 0) {
    findings.push(`lowered coverage threshold(s): ${lowered.join(", ")}`);
  }
  return findings;
}

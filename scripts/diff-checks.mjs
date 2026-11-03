// Protected-path matching and test-integrity checks, shared by
// scripts/check-pr-scope.mjs. Extracted out of the (now-removed) /dev
// engine's path-rules.mjs and test-integrity.mjs when /dev was retired —
// these two pieces were already fully generic (no /dev-specific decision
// logic), check-pr-scope.mjs is their only caller, and RULE 3 says don't
// duplicate code that already exists and is already tested.

// Minimal, dependency-free glob matcher: `*` matches within one path
// segment, `**` matches across segments (including zero). Covers every
// pattern this file's DEFAULT_PROTECTED_PATTERNS uses — not a
// general-purpose minimatch replacement.
function globToRegExp(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i += 1;
      if (pattern[i + 1] === "/") i += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (".+^${}()|[]\\".includes(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}

export function matchesGlob(path, pattern) {
  return globToRegExp(pattern).test(path);
}

export function matchesAnyGlob(path, patterns) {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}

// Only the categories expressible as a literal path/filename pattern are
// included — content-dependent categories (a YAML file that happens to
// declare a K8s Deployment; auth/permission *logic*, not just files named
// like it) need inspecting the file's content, not just its path, and are
// NOT covered here. That gap is deliberate, not an oversight: a path-only
// check cannot close it, and pretending otherwise would be worse than
// leaving it visible.
export const DEFAULT_PROTECTED_PATTERNS = Object.freeze([
  ".github/workflows/**",
  "CODEOWNERS",
  ".env*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  ".claude/**",
  "CLAUDE.md",
  "AGENTS.md",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "poetry.lock",
  "uv.lock",
  "Cargo.lock",
  ".gitmodules",
]);

export function isProtectedPath(path, extraPatterns = []) {
  return matchesAnyGlob(path, [
    ...DEFAULT_PROTECTED_PATTERNS,
    ...extraPatterns,
  ]);
}

export function changedProtectedPaths(
  changedPaths,
  extraProtectedPatterns = [],
) {
  return changedPaths.filter((path) =>
    isProtectedPath(path, extraProtectedPatterns),
  );
}

// No deleted tests, no newly added skip/xfail/only, no lowered coverage
// threshold. These are regex heuristics over unified-diff text for the
// common JS/Python test runners this org actually uses (node:test,
// vitest/jest, pytest) — not an exhaustive parse of every framework's skip
// syntax. A framework-specific gap here is a known limitation, surfaced in
// the finding text, not a silent false "clean".
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

function isCompleteModuleRetirement(changedFiles, testFiles) {
  if (testFiles.length === 0) return false;
  const moduleRoots = new Set(testFiles.map((file) => file.path.split("/")[0]));
  if (moduleRoots.size !== 1) return false;
  const [moduleRoot] = moduleRoots;
  const moduleFiles = changedFiles.filter(
    (file) => file.path.split("/")[0] === moduleRoot,
  );
  if (
    moduleFiles.length === 0 ||
    moduleFiles.some((file) => file.status !== "removed")
  )
    return false;
  return moduleFiles.some(
    (file) =>
      !/(\.test\.|\.spec\.|(^|\/)tests?\/|(^|\/)__tests__\/)/.test(file.path),
  );
}

function findAddedSkipLines(unifiedDiff) {
  return diffLines(unifiedDiff).filter((line) =>
    ADDED_SKIP_PATTERNS.some((pattern) => pattern.test(line)),
  );
}

// baseThresholds/headThresholds: {lines, branches, functions, statements} as
// declared in the repo's own coverage config — the exact config file and
// key names are per-repo, not this module's concern. This only compares two
// already-extracted number maps.
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
  if (
    removed.length > 0 &&
    !isCompleteModuleRetirement(changedFiles ?? [], removed)
  ) {
    findings.push(
      `deleted test file(s): ${removed.map((f) => f.path).join(", ")}`,
    );
  }
  const skipped = findAddedSkipLines(unifiedDiff ?? "");
  if (skipped.length > 0) {
    findings.push(`added skip/xfail/only: ${skipped.length} line(s)`);
  }
  const lowered = findLoweredThresholds(
    baseCoverageThresholds,
    headCoverageThresholds,
  );
  if (lowered.length > 0) {
    findings.push(`lowered coverage threshold(s): ${lowered.join(", ")}`);
  }
  return findings;
}

// "Module boundary" has no native git/gh concept. This is a documented
// heuristic (distinct top-level path segments among changed files), not a
// verified-correct algorithm for every repo's actual module layout.
export function countTopLevelDirectories(changedPaths) {
  const tops = new Set(changedPaths.map((p) => p.split("/")[0]));
  return tops.size;
}

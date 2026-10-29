// Minimal, dependency-free glob matcher: `*` matches within one path
// segment, `**` matches across segments (including zero). Covers every
// pattern this file and route.json's dev.protected_paths/safety_paths use --
// not a general-purpose minimatch replacement.
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

// Default protected-path list (spec/005 section 2.3-3's table). Only the
// categories expressible as a literal path/filename pattern are included --
// content-dependent categories (a YAML file that happens to declare a K8s
// Deployment; auth/permission *logic*, not just files named like it) need
// inspecting the file's content, not just its path, and are NOT covered
// here. That gap is deliberate, not an oversight: a path-only check cannot
// close it, and pretending otherwise would be worse than leaving it visible.
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
  return matchesAnyGlob(path, [...DEFAULT_PROTECTED_PATTERNS, ...extraPatterns]);
}

const TEST_OR_DOC_PATTERNS = Object.freeze([
  "**/*.test.*",
  "**/*.spec.*",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/*.md",
  "**/docs/**",
]);

function isTestOrDocPath(path) {
  return matchesAnyGlob(path, TEST_OR_DOC_PATTERNS);
}

// G4's scope half: every changed path must be inside the plan's declared
// paths, or be a test/doc file. Returns the paths that are NOT -- callers
// treat a non-empty result as a failure.
export function pathsOutsideDeclaredScope(changedPaths, declaredPlanPaths) {
  return changedPaths.filter(
    (path) =>
      !isTestOrDocPath(path) && !matchesAnyGlob(path, declaredPlanPaths),
  );
}

// G4's protected-path half: every changed path that hits the (default ∪
// per-repo additive) protected list. dev.protected_paths only ever adds to
// the default list -- it is never passed as a replacement.
export function changedProtectedPaths(changedPaths, extraProtectedPatterns = []) {
  return changedPaths.filter((path) => isProtectedPath(path, extraProtectedPatterns));
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  changedProtectedPaths,
  isProtectedPath,
  matchesAnyGlob,
  matchesGlob,
  pathsOutsideDeclaredScope,
} from "./path-rules.mjs";

test("* matches within one path segment only", () => {
  assert.equal(matchesGlob("a.test.mjs", "*.test.mjs"), true);
  assert.equal(matchesGlob("sub/a.test.mjs", "*.test.mjs"), false);
});
test("** matches any file under the directory, at any depth", () => {
  assert.equal(matchesGlob(".github/workflows/ci.yml", ".github/workflows/**"), true);
  assert.equal(matchesGlob("converters/circuit/a/b.py", "converters/circuit/**"), true);
});
test("** does not match a sibling directory with the same prefix", () =>
  assert.equal(matchesGlob("converters/circuit-notes/a.py", "converters/circuit/**"), false));
test("a literal pattern with no wildcard only matches that exact path", () => {
  assert.equal(matchesGlob("CODEOWNERS", "CODEOWNERS"), true);
  assert.equal(matchesGlob("sub/CODEOWNERS", "CODEOWNERS"), false);
});
test("matchesAnyGlob is true if any pattern in the list matches", () =>
  assert.equal(matchesAnyGlob("CLAUDE.md", ["AGENTS.md", "CLAUDE.md"]), true));

for (const path of [
  ".github/workflows/ci.yml",
  "CODEOWNERS",
  ".env.production",
  "server.pem",
  ".claude/settings.json",
  "CLAUDE.md",
  "AGENTS.md",
  "package-lock.json",
  ".gitmodules",
]) {
  test(`${path} is protected by the default list`, () =>
    assert.equal(isProtectedPath(path), true));
}
test("an ordinary source file is not protected by default", () =>
  assert.equal(isProtectedPath("src/app.py"), false));
test("a per-repo dev.protected_paths entry adds to, not replaces, the default list", () => {
  assert.equal(isProtectedPath("converters/circuit/a.py", ["converters/circuit/**"]), true);
  assert.equal(isProtectedPath("CODEOWNERS", ["converters/circuit/**"]), true);
});

test("pathsOutsideDeclaredScope returns only the paths not covered by the plan or by tests/docs", () => {
  const outside = pathsOutsideDeclaredScope(
    ["src/app.py", "src/app.test.py", "README.md", "unrelated/other.py"],
    ["src/**"],
  );
  assert.deepEqual(outside, ["unrelated/other.py"]);
});
test("pathsOutsideDeclaredScope is empty when every changed path is in scope", () =>
  assert.deepEqual(
    pathsOutsideDeclaredScope(["src/app.py", "src/app.test.py"], ["src/**"]),
    [],
  ));

test("changedProtectedPaths reports only the hits, using default plus extra patterns", () => {
  const hits = changedProtectedPaths(
    ["src/app.py", "CODEOWNERS", "converters/circuit/a.py"],
    ["converters/circuit/**"],
  );
  assert.deepEqual(hits, ["CODEOWNERS", "converters/circuit/a.py"]);
});

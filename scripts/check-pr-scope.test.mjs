import assert from "node:assert/strict";
import test from "node:test";

import {
  parseNameStatus,
  sumNumstat,
  withinRule4SizeCap,
  evaluateScope,
} from "./check-pr-scope.mjs";

// --- parseNameStatus ---------------------------------------------------
test("parseNameStatus reads modified/added/deleted/renamed lines", () => {
  const raw = [
    "M\tREADME.md",
    "A\tscripts/new.mjs",
    "D\tscripts/old.mjs",
    "R100\tscripts/a.mjs\tscripts/b.mjs",
  ].join("\n");
  assert.deepEqual(parseNameStatus(raw), [
    { path: "README.md", status: "modified" },
    { path: "scripts/new.mjs", status: "added" },
    { path: "scripts/old.mjs", status: "removed" },
    { path: "scripts/b.mjs", status: "renamed" },
  ]);
});
test("parseNameStatus returns an empty list for an empty diff", () =>
  assert.deepEqual(parseNameStatus(""), []));

// --- sumNumstat ----------------------------------------------------------
test("sumNumstat adds additions and deletions across files", () =>
  assert.equal(sumNumstat(["10\t5\ta.mjs", "3\t0\tb.mjs"].join("\n")), 18));
test("sumNumstat treats a binary file's dash counts as zero, not NaN", () =>
  assert.equal(sumNumstat("-\t-\timage.png\n4\t1\ta.mjs"), 5));

// --- withinRule4SizeCap (RULE 4's OR, deliberately not guardG5's AND) ---
test("passes when lines are within cap even if module boundaries are not", () =>
  assert.equal(
    withinRule4SizeCap({ totalLinesChanged: 10, moduleBoundariesTouched: 5 }),
    true,
  ));
test("passes when module boundary is within cap even if lines are not", () =>
  assert.equal(
    withinRule4SizeCap({ totalLinesChanged: 9999, moduleBoundariesTouched: 1 }),
    true,
  ));
test("fails only when both lines and module boundaries exceed cap", () =>
  assert.equal(
    withinRule4SizeCap({ totalLinesChanged: 401, moduleBoundariesTouched: 2 }),
    false,
  ));
test("401 lines and exactly 1 module boundary still passes (boundary condition)", () =>
  assert.equal(
    withinRule4SizeCap({ totalLinesChanged: 401, moduleBoundariesTouched: 1 }),
    true,
  ));

// --- evaluateScope (integration over the real engine/ guard functions) --
test("a small, clean change passes with no findings", () => {
  const result = evaluateScope({
    changedFiles: [{ path: "spec/010-example.md", status: "added" }],
    unifiedDiff: "+hello\n",
    totalLinesChanged: 10,
    moduleBoundariesTouched: 1,
  });
  assert.equal(result.pass, true);
  assert.deepEqual(result.integrityFindings, []);
  assert.deepEqual(result.protectedHits, []);
});
test("touching a protected path is a warning signal, not a failure", () => {
  const result = evaluateScope({
    changedFiles: [{ path: "CLAUDE.md", status: "modified" }],
    unifiedDiff: "+hello\n",
    totalLinesChanged: 5,
    moduleBoundariesTouched: 1,
  });
  assert.equal(result.pass, true);
  assert.deepEqual(result.protectedHits, ["CLAUDE.md"]);
});
test("deleting a test file fails via test-integrity regardless of size", () => {
  const result = evaluateScope({
    changedFiles: [{ path: "scripts/foo.test.mjs", status: "removed" }],
    unifiedDiff: "",
    totalLinesChanged: 1,
    moduleBoundariesTouched: 1,
  });
  assert.equal(result.pass, false);
  assert.ok(result.integrityFindings.length > 0);
});
test("retiring a whole top-level module with its tests is allowed by integrity", () => {
  const result = evaluateScope({
    changedFiles: [
      { path: "retired-engine/core.mjs", status: "removed" },
      { path: "retired-engine/core.test.mjs", status: "removed" },
    ],
    unifiedDiff: "",
    totalLinesChanged: 20,
    moduleBoundariesTouched: 1,
  });
  assert.equal(result.pass, true);
  assert.deepEqual(result.integrityFindings, []);
});
test("module retirement exception does not permit an added source file", () => {
  const result = evaluateScope({
    changedFiles: [
      { path: "retired-engine/core.mjs", status: "modified" },
      { path: "retired-engine/core.test.mjs", status: "removed" },
    ],
    unifiedDiff: "",
    totalLinesChanged: 20,
    moduleBoundariesTouched: 1,
  });
  assert.equal(result.pass, false);
  assert.ok(result.integrityFindings.length > 0);
});
test("oversized AND multi-module fails via the size cap", () => {
  const result = evaluateScope({
    changedFiles: [{ path: "a.mjs", status: "modified" }],
    unifiedDiff: "",
    totalLinesChanged: 500,
    moduleBoundariesTouched: 3,
  });
  assert.equal(result.pass, false);
  assert.equal(result.sizeOk, false);
});

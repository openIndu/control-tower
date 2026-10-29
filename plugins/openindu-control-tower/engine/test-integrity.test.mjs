import assert from "node:assert/strict";
import test from "node:test";

import { checkTestIntegrity } from "./test-integrity.mjs";

test("clean change: no findings", () => {
  const findings = checkTestIntegrity({
    changedFiles: [{ path: "src/app.py", status: "modified" }],
    unifiedDiff: "+console.log('ok');\n",
    baseCoverageThresholds: { lines: 70 },
    headCoverageThresholds: { lines: 70 },
  });
  assert.deepEqual(findings, []);
});

test("flags a deleted test file", () => {
  const findings = checkTestIntegrity({
    changedFiles: [{ path: "src/app.test.mjs", status: "removed" }],
    unifiedDiff: "",
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /deleted test file/);
});
test("does not flag a deleted non-test file", () => {
  const findings = checkTestIntegrity({
    changedFiles: [{ path: "src/old-helper.py", status: "removed" }],
    unifiedDiff: "",
  });
  assert.deepEqual(findings, []);
});

for (const [label, line] of [
  ["node:test/vitest/jest .skip(", "+test.skip('x', () => {});"],
  ["node:test/vitest/jest .only(", "+it.only('x', () => {});"],
  ["pytest skip marker", "+@pytest.mark.skip(reason='flaky')"],
  ["pytest xfail marker", "+@pytest.mark.xfail"],
]) {
  test(`flags an added ${label}`, () => {
    const findings = checkTestIntegrity({ changedFiles: [], unifiedDiff: line });
    assert.equal(findings.length, 1);
    assert.match(findings[0], /skip\/xfail\/only/);
  });
}
test("does not flag a removed skip line (only additions count)", () => {
  const findings = checkTestIntegrity({
    changedFiles: [],
    unifiedDiff: "-test.skip('x', () => {});",
  });
  assert.deepEqual(findings, []);
});

test("flags a lowered coverage threshold", () => {
  const findings = checkTestIntegrity({
    changedFiles: [],
    unifiedDiff: "",
    baseCoverageThresholds: { lines: 80, branches: 70 },
    headCoverageThresholds: { lines: 60, branches: 70 },
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /lowered coverage threshold.*lines: 80 -> 60/);
});
test("does not flag a raised coverage threshold", () => {
  const findings = checkTestIntegrity({
    changedFiles: [],
    unifiedDiff: "",
    baseCoverageThresholds: { lines: 80 },
    headCoverageThresholds: { lines: 90 },
  });
  assert.deepEqual(findings, []);
});

test("reports every category at once when all three are present", () => {
  const findings = checkTestIntegrity({
    changedFiles: [{ path: "src/app.test.mjs", status: "removed" }],
    unifiedDiff: "+test.skip('x', () => {});",
    baseCoverageThresholds: { lines: 80 },
    headCoverageThresholds: { lines: 50 },
  });
  assert.equal(findings.length, 3);
});

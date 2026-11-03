import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transition } from "./workflow-state.mjs";
import { checkSource } from "../../build/scripts/check-source.mjs";

test("build requires intact checkpoint evidence and exact clean source", () => {
  const root = mkdtempSync(join(tmpdir(), "build-source-"));
  try {
    const taskDir = join(root, "tasks/issue-1"); mkdirSync(taskDir, {recursive: true});
    writeFileSync(join(taskDir, "report.md"), "Observed evidence");
    const sha = "a".repeat(40), other = "b".repeat(40);
    const checks = Object.fromEntries(["UT", "IT", "LOCAL", "MANUAL", "CLEANUP"].map(k => [k, {status: "PASS", evidence: k}]));
    let state = {repo: "openindu/control-tower", tasks: {}};
    for (const stage of ["research", "prod", "dev", "test"]) state = transition(state, {action: "stage", taskId: "issue-1", stage, status: "PASS", reason: "Verified", artifact: "report.md", decision: "CONTINUE", blockers: [], acceptanceCount: 1, sourceSha: sha, checks}, taskDir);
    const stateFile = join(root, "state.json"); writeFileSync(stateFile, JSON.stringify(state));
    const manifest = {repo: "openIndu/control-tower", sourceSha: sha, checkpoint: {stateFile, taskId: "issue-1"}};
    assert.equal(checkSource(".", manifest, args => args[0] === "rev-parse" ? sha : "").sourceSha, sha);
    assert.throws(() => checkSource(".", manifest, () => other), /Checkout differs/);
    assert.throws(() => checkSource(".", manifest, args => args[0] === "rev-parse" ? sha : " M source"), /dirty/);
    writeFileSync(join(taskDir, "report.md"), "Changed");
    assert.throws(() => checkSource(".", manifest, () => sha), /evidence changed/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});

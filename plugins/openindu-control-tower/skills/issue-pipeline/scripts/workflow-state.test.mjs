import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute, transition, repository } from "./workflow-state.mjs";

test("state records ordered evidence and prevents uncertain replay", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-state-"));
  try {
    writeFileSync(join(root, "report.md"), "Evidence");
    const sha = "a".repeat(40);
    const checks = Object.fromEntries(["UT", "IT", "LOCAL", "MANUAL", "CLEANUP"].map(k => [k, {status: "PASS", evidence: k}]));
    const request = stage => ({action: "stage", taskId: "issue-1", stage, status: "PASS", reason: "Verified", artifact: "report.md", decision: "CONTINUE", blockers: [], acceptanceCount: 1, sourceSha: sha, checks});
    let state = {repo: "openindu/control-tower", tasks: {}};
    assert.throws(() => transition(state, request("dev"), root), /Previous/);
    for (const stage of ["research", "prod", "dev", "test"]) state = transition(state, request(stage), root);
    const intent = {action: "intent", taskId: "issue-1", key: "first", kind: "create_pr", target: "refs/heads/fix/issue-1", sourceSha: sha, artifact: "report.md"};
    state = transition(state, intent, root);
    assert.throws(() => transition(state, {...intent, key: "second"}, root), /Existing target/);
    assert.throws(() => transition(state, request("dev"), root), /Reconcile pending/);
    state = transition(state, {action: "reconcile", taskId: "issue-1", key: "first", result: "NOT_APPLIED", remoteUrl: "https://github.com/openIndu/control-tower", artifact: "report.md"}, root);
    assert.equal(transition(state, {...intent, key: "second"}, root).tasks["issue-1"].operations.second.state, "PENDING");
    execute(root, "openIndu/control-tower", {action: "start", runId: "one"});
    assert.throws(() => execute(root, "openIndu/control-tower", {action: "start", runId: "two"}), /EEXIST/);
    assert.throws(() => repository("other/project"), /Only openIndu/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});

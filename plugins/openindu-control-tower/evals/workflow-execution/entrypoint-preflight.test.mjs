import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { planRequest } from "../../skills/issue-pipeline/scripts/workflow-request.mjs";
import { transition } from "../../skills/issue-pipeline/scripts/workflow-state.mjs";

const started = performance.now(), head = "a".repeat(40), other = "b".repeat(40);
const image = `registry.example.invalid/openindu/backend@sha256:${"c".repeat(64)}`;
const route = JSON.parse(readFileSync(new URL("../../reference/route.json", import.meta.url), "utf8"));
let scenarios = 0;
function scenario(name, fn) {
  scenarios++;
  test(name, () => {
    const root = mkdtempSync(join(tmpdir(), "entrypoint-preflight-"));
    try {
      writeFileSync(join(root, "report.md"), "Observed task evidence");
      let state = { version: 1, repo: "openindu/openindu-backend", tasks: {} };
      const checks = Object.fromEntries(["UT", "IT", "LOCAL", "MANUAL", "CLEANUP"].map(k => [k, {status: "PASS", evidence: k}]));
      for (const stage of ["research", "prod", "dev", "test"]) state = transition(state, {action: "stage", taskId: "issue-123", stage, status: "PASS", reason: "Verified", artifact: "report.md", decision: "CONTINUE", blockers: [], acceptanceCount: 1, sourceSha: head, checks}, root);
      state = transition(state, {action: "build", taskId: "issue-123", sourceSha: head, image, artifact: "report.md"}, root);
      const request = {command: "research", repo: "openIndu/openindu-backend", taskId: "issue-123", runId: "run-1", question: "Compare similar products and differentiation", sourceSha: head, image};
      fn({ root, state, request, run: (input = request, checkpoint = state, routes = route) => planRequest(input, routes, checkpoint, root) });
    } finally { rmSync(root, {recursive: true, force: true}); }
  });
}
for (const command of ["research", "prod", "dev", "test", "publish", "dev_issue"]) {
  scenario(`${command} accepts valid scoped evidence`, ({request, run}) => {
    const result = run({...request, command});
    assert.equal(result.command, command);
    assert.equal(result.authorization, "NOT_GRANTED_BY_PREFLIGHT");
  });
}
for (const command of ["research", "prod", "dev", "test", "publish", "dev_issue"]) {
  scenario(`${command} dry-run performs no persistent write`, ({root, request, run}) => {
    const before = readdirSync(root);
    assert.equal(run({...request, command, dryRun: true}).dryRun, true);
    assert.deepEqual(readdirSync(root), before);
  });
}
for (const [name, patch] of [
  ["foreign organization", {repo: "other/openindu-backend"}],
  ["unknown repository", {repo: "openIndu/unknown-repo"}],
  ["path traversal", {taskId: "../other"}],
  ["invalid run ID", {runId: "run; shell"}],
  ["missing question", {question: ""}],
  ["invalid dryRun type", {dryRun: "false"}],
  ["unknown workflow", {command: "shell"}],
]) scenario(`reject ${name}`, ({request, run}) => assert.throws(() => run({...request, ...patch})));
scenario("reject route pointing at a foreign owner", ({request, run}) => {
  const routes = structuredClone(route); routes.repos["openindu-backend"].url = "https://github.com/other/openindu-backend";
  assert.throws(() => run(request, undefined, routes), /owner\/host/);
});
scenario("product rejects absent research", ({state, request, run}) => {
  delete state.tasks[request.taskId].stages.research;
  assert.throws(() => run({...request, command: "prod"}), /research/);
});
scenario("development rejects another task checkpoint", ({state, request, run}) => {
  state.repo = "openindu/openindu-studio";
  assert.throws(() => run({...request, command: "dev"}), /Matching task/);
});
scenario("changed research blocks downstream product", ({root, request, run}) => {
  writeFileSync(join(root, "report.md"), "Changed after checkpoint");
  assert.throws(() => run({...request, command: "prod"}), /Changed prerequisite/);
});
scenario("development rejects unresolved write effects", ({state, request, run}) => {
  state.tasks[request.taskId].operations.push = {state: "BLOCKED"};
  assert.throws(() => run({...request, command: "dev"}), /Reconcile uncertain/);
});
scenario("local test rejects a different source commit", ({request, run}) => assert.throws(() => run({...request, command: "test", sourceSha: other}), /SHA mismatch/));
scenario("publish rejects skipped local testing", ({state, request, run}) => {
  state.tasks[request.taskId].stages.test.status = "NA";
  assert.throws(() => run({...request, command: "publish"}), /cannot be skipped/);
});
scenario("publish rejects unverified build", ({state, request, run}) => {
  delete state.tasks[request.taskId].build;
  assert.throws(() => run({...request, command: "publish"}), /verified build/);
});
scenario("publish rejects mutable tags", ({request, run}) => assert.throws(() => run({...request, command: "publish", image: "registry/image:latest"}), /digest required/));
scenario("publish rejects substituted target", ({request, run}) => assert.throws(() => run({...request, command: "publish", publishTarget: "other/infra-deploy"}), /target must/));
scenario("publish rejects stale test SHA", ({state, request, run}) => {
  state.tasks[request.taskId].stages.test.sourceSha = other;
  assert.throws(() => run({...request, command: "publish"}), /Stale test/);
});
scenario("publish rejects changed registry evidence", ({root, state, request, run}) => {
  writeFileSync(join(root, "registry.md"), "Old registry evidence");
  state.tasks[request.taskId].build.evidence = {path: "registry.md", sha256: "f".repeat(64)};
  assert.throws(() => run({...request, command: "publish"}), /Changed registry/);
});
scenario("repository issue flow never includes merge or deploy", ({request, run}) => {
  const plan = run({...request, command: "dev_issue"});
  assert.deepEqual(plan.phases, ["research", "prod", "dev", "test", "PR_GREEN"]);
});
scenario("Gitee Issues fail explicitly before collection", ({request, run}) => assert.throws(() => run({...request, command: "dev_issue", repo: "openIndu/infra-deploy"}), /GitHub repository/));
after(() => console.log(JSON.stringify({suite: "entrypoint-preflight-v1", scenarios, durationMs: Math.round(performance.now() - started), llmCalls: 0, tokenCost: 0, baseline: "spec009 regression suite retained; deterministic preflight only"})));

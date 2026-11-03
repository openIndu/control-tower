#!/usr/bin/env node
// Version 1. Deterministic preflight, not an authorization grant or agent runner.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { artifact, repository } from "./workflow-state.mjs";

const prerequisites = {
  research: [], prod: ["research"], dev: ["research", "prod"],
  test: ["research", "prod", "dev"],
  publish: ["research", "prod", "dev", "test"], dev_issue: [],
};
const fullSha = /^[a-f0-9]{40}$/;
function need(value, reason) { if (!value) throw new Error(reason); }
export function planRequest(request, route, state = null, taskRoot = null) {
  need(request && typeof request === "object", "Request object required");
  const command = String(request.command ?? "").replace(/^\//, "");
  need(Object.hasOwn(prerequisites, command), "Unknown workflow command");
  const repo = repository(request.repo);
  const name = repo.split("/")[1], entry = route.repos?.[name];
  need(entry, "Repository absent from authoritative route");
  need(typeof entry.url === "string" && /^https:\/\/(github|gitee)\.com\/openindu\//i.test(entry.url), "Route owner/host invalid");
  need(entry.url.replace(/\/$/, "").toLowerCase().endsWith(`/${name}`), "Route repository mismatch");
  need(typeof request.runId === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(request.runId), "Valid runId required");
  need(request.dryRun === undefined || typeof request.dryRun === "boolean", "dryRun must be boolean");
  if (command !== "dev_issue") need(typeof request.taskId === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(request.taskId), "Valid taskId required");
  if (command === "dev_issue") need(entry.url.toLowerCase().startsWith("https://github.com/"), "Issue collector requires a GitHub repository");
  if (command === "research") need(typeof request.question === "string" && request.question.trim(), "Research question required");
  const required = prerequisites[command], task = state?.tasks?.[request.taskId];
  if (required.length) {
    need(state?.repo === repo && task && taskRoot, "Matching task checkpoint required");
    for (const stage of required) {
      const record = task.stages?.[stage];
      need(record && ["PASS", "NA"].includes(record.status), `Missing prerequisite: ${stage}`);
      if (["dev", "test"].includes(stage)) need(record.status === "PASS", `${stage} cannot be skipped`);
      need(record.evidence && artifact(taskRoot, record.evidence.path).sha256 === record.evidence.sha256, `Changed prerequisite evidence: ${stage}`);
    }
    need(!Object.values(task.operations ?? {}).some(o => ["PENDING", "BLOCKED"].includes(o.state)), "Reconcile uncertain writes first");
  }
  if (["dev", "test", "publish"].includes(command)) need(fullSha.test(request.sourceSha), "Full source SHA required");
  if (["test", "publish"].includes(command)) need(task.sourceSha === request.sourceSha, "Task/source SHA mismatch");
  if (command === "publish") {
    const gitops = route.repos?.["infra-deploy"];
    need(gitops?.url?.replace(/\/$/, "").toLowerCase() === "https://gitee.com/openindu/infra-deploy", "Authoritative infra-deploy target missing");
    need(request.publishTarget === undefined || request.publishTarget.toLowerCase() === "openindu/infra-deploy", "Publish target must be openIndu/infra-deploy");
    need(typeof request.image === "string" && /^[^\s@]+@sha256:[a-f0-9]{64}$/.test(request.image), "Immutable image digest required");
    need(task.stages.test.sourceSha === request.sourceSha, "Stale test checkpoint");
    need(task.build?.sourceSha === request.sourceSha && task.build.image === request.image, "Matching verified build required");
    need(task.build.evidence && artifact(taskRoot, task.build.evidence.path).sha256 === task.build.evidence.sha256, "Changed registry evidence");
  }
  return {
    schemaVersion: 1, command, repo, runId: request.runId, taskId: request.taskId ?? null,
    dryRun: request.dryRun ?? false, prerequisites: required,
    phases: command === "dev_issue" ? ["research", "prod", "dev", "test", "PR_GREEN"] : [command],
    target: command === "publish" ? "openindu/infra-deploy" : repo,
    terminal: command === "publish" ? "GITOPS_PR_VERIFIED" : command === "dev_issue" ? "PR_GREEN" : "STAGE_RECORDED",
    authorization: "NOT_GRANTED_BY_PREFLIGHT",
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const request = JSON.parse(readFileSync(process.argv[2], "utf8"));
    const route = JSON.parse(readFileSync(new URL("../../../reference/route.json", import.meta.url), "utf8"));
    const state = request.checkpointFile ? JSON.parse(readFileSync(request.checkpointFile, "utf8")) : null;
    const taskRoot = request.checkpointFile && request.taskId ? join(dirname(resolve(request.checkpointFile)), "tasks", request.taskId) : null;
    console.log(JSON.stringify(planRequest(request, route, state, taskRoot), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

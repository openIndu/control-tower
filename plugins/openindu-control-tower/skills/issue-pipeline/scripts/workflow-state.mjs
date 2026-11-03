#!/usr/bin/env node
// Version 1: local durable checkpoints; never performs platform writes.
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  realpathSync,
} from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const stages = ["research", "prod", "dev", "test"];
const sha = /^[a-f0-9]{40}$/;
function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}
export function repository(value) {
  requireValue(
    /^openindu\/[a-z0-9][a-z0-9._-]*$/i.test(value),
    "Only openIndu repositories are allowed",
  );
  return value.toLowerCase();
}
function identifier(value) {
  requireValue(
    typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value),
    "Invalid task/run identifier",
  );
  return value;
}
export function artifact(root, path) {
  requireValue(typeof path === "string", "Artifact path required");
  const target = resolve(root, path),
    rel = relative(root, target);
  requireValue(
    rel && !rel.startsWith("..") && !isAbsolute(rel),
    "Artifact must be inside task directory",
  );
  const real = relative(realpathSync(root), realpathSync(target));
  requireValue(
    real && !real.startsWith("..") && !isAbsolute(real),
    "Artifact symlink escapes task directory",
  );
  const bytes = readFileSync(target);
  requireValue(bytes.length > 0, "Empty evidence artifact");
  return {
    path: rel.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
export function transition(state, request, taskRoot) {
  const id = identifier(request.taskId);
  const task = structuredClone(
    state.tasks[id] ?? { stages: {}, operations: {} },
  );
  if (["build", "intent"].includes(request.action)) {
    for (const record of Object.values(task.stages)) {
      requireValue(
        artifact(taskRoot, record.evidence.path).sha256 ===
          record.evidence.sha256,
        "Evidence changed; rerun affected stage",
      );
    }
  }
  if (request.action === "stage") {
    const index = stages.indexOf(request.stage);
    requireValue(index >= 0, "Unknown stage");
    requireValue(
      ["PASS", "NA"].includes(request.status),
      "Stage status must be PASS or NA",
    );
    requireValue(
      stages.slice(0, index).every((s) => task.stages[s]),
      "Previous stage missing",
    );
    requireValue(
      !["dev", "test"].includes(request.stage) || request.status === "PASS",
      "Development/test cannot be skipped",
    );
    requireValue(
      typeof request.reason === "string" && request.reason.trim(),
      "Reason required",
    );
    if (request.stage === "research" && request.status === "PASS")
      requireValue(
        request.decision === "CONTINUE",
        "Research must support proceeding",
      );
    if (request.stage === "prod" && request.status === "PASS")
      requireValue(
        Array.isArray(request.blockers) &&
          request.blockers.length === 0 &&
          Number.isInteger(request.acceptanceCount) &&
          request.acceptanceCount > 0,
        "Product needs acceptance criteria and no blockers",
      );
    if (index >= 2)
      requireValue(sha.test(request.sourceSha), "Full source SHA required");
    if (request.stage === "test") {
      requireValue(
        request.sourceSha === task.sourceSha,
        "Test/source SHA mismatch",
      );
      requireValue(
        ["UT", "IT", "LOCAL", "MANUAL", "CLEANUP"].every(
          (kind) =>
            request.checks?.[kind]?.status === "PASS" &&
            typeof request.checks[kind].evidence === "string" &&
            request.checks[kind].evidence.trim(),
        ),
        "UT/IT/local/manual/cleanup evidence required",
      );
    }
    const evidence = artifact(taskRoot, request.artifact);
    requireValue(
      !Object.values(task.operations).some((o) =>
        ["PENDING", "BLOCKED"].includes(o.state),
      ),
      "Reconcile pending writes before rerunning stages",
    );
    // Rerunning any phase invalidates all later evidence; retain write history.
    for (const later of stages.slice(index + 1)) delete task.stages[later];
    delete task.build;
    if (index <= 2)
      task.sourceSha = request.stage === "dev" ? request.sourceSha : null;
    task.stages[request.stage] = {
      status: request.status,
      reason: request.reason,
      evidence,
      sourceSha: request.sourceSha ?? null,
      checks: request.checks ?? null,
    };
  } else if (request.action === "build") {
    requireValue(
      task.stages.test?.status === "PASS" &&
        task.sourceSha === request.sourceSha,
      "Build requires tests for exact source SHA",
    );
    requireValue(
      typeof request.image === "string" &&
        /^[^\s@]+@sha256:[a-f0-9]{64}$/.test(request.image),
      "Remote immutable image digest required",
    );
    task.build = {
      sourceSha: request.sourceSha,
      image: request.image,
      evidence: artifact(taskRoot, request.artifact),
    };
  } else if (request.action === "intent") {
    requireValue(
      stages.every((s) => task.stages[s]) && task.stages.test.status === "PASS",
      "Four stages required before PR write",
    );
    requireValue(
      request.sourceSha === task.sourceSha,
      "Intent/source SHA mismatch",
    );
    const key = identifier(request.key);
    requireValue(
      ["push", "create_pr"].includes(request.kind),
      "Write kind required",
    );
    requireValue(
      typeof request.target === "string" &&
        /^refs\/heads\/[a-z0-9/_-]+$/i.test(request.target),
      "Branch target required",
    );
    requireValue(
      !Object.values(task.operations).some(
        (o) =>
          o.kind === request.kind &&
          o.target === request.target &&
          o.state !== "NOT_APPLIED" &&
          (o.state !== "APPLIED" ||
            request.kind === "create_pr" ||
            o.sourceSha === request.sourceSha),
      ),
      "Existing target operation: reconcile or reuse instead of retrying",
    );
    requireValue(
      !task.operations[key],
      "Existing operation: reconcile instead of retrying",
    );
    task.operations[key] = {
      state: "PENDING",
      kind: request.kind,
      target: request.target,
      sourceSha: task.sourceSha,
      evidence: artifact(taskRoot, request.artifact),
    };
  } else if (request.action === "reconcile") {
    const operation = task.operations[identifier(request.key)];
    requireValue(operation, "Unknown write intent");
    requireValue(
      ["APPLIED", "NOT_APPLIED", "BLOCKED"].includes(request.result),
      "Unknown read-back result",
    );
    const prefix = `https://github.com/${state.repo}`;
    requireValue(
      typeof request.remoteUrl === "string" &&
        (request.remoteUrl.toLowerCase() === prefix ||
          request.remoteUrl.toLowerCase().startsWith(`${prefix}/`)),
      "Read-back repository mismatch",
    );
    if (request.result === "APPLIED") {
      const suffix = request.remoteUrl.slice(prefix.length);
      requireValue(
        /^\/(pull\/\d+|commit\/[a-f0-9]{40}|tree\/[^\s?#]+)$/.test(suffix),
        "Applied write needs PR/branch/commit evidence",
      );
      requireValue(
        request.observedSha === operation.sourceSha,
        "Read-back source SHA mismatch",
      );
    }
    operation.state = request.result;
    operation.remoteUrl = request.remoteUrl;
    operation.evidence = artifact(taskRoot, request.artifact);
  } else throw new Error("Unknown action");
  return {
    ...state,
    tasks: { ...state.tasks, [id]: task },
    events: [
      ...(state.events ?? []),
      {
        taskId: id,
        action: request.action,
        stage: request.stage ?? null,
        key: request.key ?? null,
        result: request.result ?? request.status ?? null,
        at: new Date().toISOString(),
      },
    ],
  };
}
export function execute(root, repo, request) {
  repo = repository(repo);
  const runId = identifier(request.runId),
    dir = join(resolve(root), ...repo.split("/"));
  mkdirSync(dir, { recursive: true });
  const lease = join(dir, "lease.json"),
    file = join(dir, "state.json");
  if (request.action === "start") {
    // Persistent lease deliberately has no timeout: never steal work from a paused run.
    writeFileSync(lease, JSON.stringify({ runId }), { flag: "wx" });
    return { repo, runId, status: "LOCKED" };
  }
  requireValue(
    JSON.parse(readFileSync(lease, "utf8")).runId === runId,
    "Repository owned by another run",
  );
  // Also exclude overlapping checkpoint commands within the same run.
  const mutex = join(dir, "checkpoint.lock");
  writeFileSync(mutex, runId, { flag: "wx" });
  try {
    const state = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { version: 1, repo, tasks: {} };
    if (request.action === "inspect") return state;
    if (request.action === "release") {
      unlinkSync(lease);
      return { repo, status: "RELEASED" };
    }
    const taskRoot = join(dir, "tasks", identifier(request.taskId));
    mkdirSync(taskRoot, { recursive: true });
    const next = transition(state, request, taskRoot),
      temporary = `${file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
      flag: "w",
    });
    renameSync(temporary, file);
    return next;
  } finally {
    unlinkSync(mutex);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [, , root, repo, input] = process.argv;
    console.log(
      JSON.stringify(
        execute(root, repo, JSON.parse(readFileSync(input, "utf8"))),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

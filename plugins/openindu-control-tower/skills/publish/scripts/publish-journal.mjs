#!/usr/bin/env node
// Version 2. Independent Gitee publication journal; never performs platform writes.
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  artifact,
  repository,
} from "../../issue-pipeline/scripts/workflow-state.mjs";

const need = (ok, reason) => {
  if (!ok) throw new Error(reason);
};
const idPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const fullSha = /^[a-f0-9]{40}$/;
export function publicationTransition(state, request, evidenceRoot) {
  need(
    typeof request.key === "string" && idPattern.test(request.key),
    "Publication key required",
  );
  const operations = structuredClone(state.operations ?? {});
  if (request.action === "intent") {
    const sourceRepo = repository(request.sourceRepo);
    need(
      typeof request.taskId === "string" && idPattern.test(request.taskId),
      "Source task required",
    );
    need(
      fullSha.test(request.sourceSha) &&
        fullSha.test(request.headSha) &&
        fullSha.test(request.baseSha),
      "Full product, infra head, and base SHA required",
    );
    need(
      typeof request.branch === "string" &&
        /^release\/[a-z0-9][a-z0-9/_-]*$/i.test(request.branch),
      "Release branch required",
    );
    need(
      typeof request.baseBranch === "string" &&
        /^[a-z0-9][a-z0-9._/-]*$/i.test(request.baseBranch),
      "Gitee default base branch required",
    );
    need(
      typeof request.image === "string" &&
        /^[^\s@]+@sha256:[a-f0-9]{64}$/.test(request.image),
      "Immutable image required",
    );
    need(!operations[request.key], "Existing key: reconcile instead of replay");
    const sameIdentity = (o) =>
      o.sourceRepo === sourceRepo &&
      o.taskId === request.taskId &&
      o.sourceSha === request.sourceSha &&
      o.image === request.image;
    need(
      !Object.values(operations).some(
        (o) =>
          (o.applied && sameIdentity(o)) ||
          (o.state !== "NOT_APPLIED" &&
            (o.branch === request.branch || sameIdentity(o))),
      ),
      "Existing publication: reconcile or reuse",
    );
    operations[request.key] = {
      sourceRepo,
      taskId: request.taskId,
      sourceSha: request.sourceSha,
      headSha: request.headSha,
      branch: request.branch,
      baseBranch: request.baseBranch,
      baseSha: request.baseSha,
      image: request.image,
      applied: false,
      state: "PENDING",
      intent: artifact(evidenceRoot, request.artifact),
      readBackHistory: [],
    };
  } else if (request.action === "refresh_base") {
    const operation = operations[request.key];
    need(
      operation && !operation.applied,
      "Only an unapplied publication can refresh its base",
    );
    need(
      Number.isInteger(request.prId) &&
        request.prId > 0 &&
        request.prId === operation.prId,
      "Existing Gitee PR identity required",
    );
    need(
      request.url?.toLowerCase() === operation.url &&
        request.url ===
          `https://gitee.com/openindu/infra-deploy/pulls/${request.prId}`,
      "Existing Gitee PR URL mismatch",
    );
    need(
      request.actualBranch === operation.branch &&
        request.actualBaseBranch === operation.baseBranch,
      "Existing Gitee source/base branch mismatch",
    );
    need(
      request.actualHeadSha === operation.headSha &&
        request.actualImage === operation.image,
      "Existing Gitee head/image mismatch",
    );
    need(
      fullSha.test(request.actualBaseSha) &&
        request.actualBaseSha !== operation.baseSha,
      "New full base SHA required",
    );
    need(
      typeof request.reason === "string" && request.reason.trim(),
      "Base refresh reason required",
    );
    operation.readBackHistory.push({
      at: new Date().toISOString(),
      runId: request.runId,
      result: "BASE_REFRESHED",
      reason: request.reason,
      prId: request.prId,
      url: request.url,
      actualBranch: request.actualBranch,
      actualBaseBranch: request.actualBaseBranch,
      actualBaseSha: request.actualBaseSha,
      actualHeadSha: request.actualHeadSha,
      actualImage: request.actualImage,
      evidence: artifact(evidenceRoot, request.artifact),
    });
    operation.baseSha = request.actualBaseSha;
    operation.state = "PENDING";
  } else if (request.action === "reconcile") {
    const operation = operations[request.key];
    need(operation, "Unknown publication intent");
    need(
      ["APPLIED", "NOT_APPLIED", "BLOCKED"].includes(request.result),
      "Read-back result required",
    );
    need(
      typeof request.reason === "string" && request.reason.trim(),
      "Read-back reason required",
    );
    need(
      !(operation.applied && request.result === "NOT_APPLIED"),
      "An applied publication cannot be downgraded",
    );
    const baseSha = request.actualBaseSha;
    if (request.result === "APPLIED") {
      need(
        Number.isInteger(request.prId) && request.prId > 0,
        "Gitee PR ID required",
      );
      need(
        request.url?.toLowerCase() ===
          `https://gitee.com/openindu/infra-deploy/pulls/${request.prId}`,
        "Gitee PR target mismatch",
      );
      need(
        request.actualBranch === operation.branch &&
          request.actualBaseBranch === operation.baseBranch,
        "Gitee source/base branch read-back mismatch",
      );
      need(
        request.actualHeadSha === operation.headSha &&
          request.actualImage === operation.image,
        "Gitee head/image read-back mismatch",
      );
      need(fullSha.test(baseSha), "Gitee base SHA read-back required");
      need(
        baseSha === operation.baseSha,
        "Gitee base moved; refresh the existing PR base before applying",
      );
      operation.applied = true;
    }
    if (request.prId !== undefined) {
      need(
        Number.isInteger(request.prId) && request.prId > 0,
        "Gitee PR ID must be positive",
      );
      need(
        request.url?.toLowerCase() ===
          `https://gitee.com/openindu/infra-deploy/pulls/${request.prId}`,
        "Gitee PR target mismatch",
      );
      need(
        !operation.prId ||
          (operation.prId === request.prId && operation.url === request.url),
        "Publication PR identity cannot change",
      );
      operation.prId = request.prId;
      operation.url = request.url;
    }
    operation.state = request.result;
    operation.readBackHistory.push({
      at: new Date().toISOString(),
      runId: request.runId,
      result: request.result,
      reason: request.reason,
      prId: request.prId ?? null,
      url: request.url ?? null,
      actualBranch: request.actualBranch ?? null,
      actualBaseBranch: request.actualBaseBranch ?? null,
      actualBaseSha: baseSha ?? null,
      actualHeadSha: request.actualHeadSha ?? null,
      actualImage: request.actualImage ?? null,
      evidence: artifact(evidenceRoot, request.artifact),
    });
  } else throw new Error("Unknown publication action");
  return { version: 2, target: "openindu/infra-deploy", operations };
}

export function recordPublication(root, request) {
  need(
    request.dryRun !== true,
    "Dry-run cannot create a lease or publication journal",
  );
  need(
    typeof request.runId === "string" && idPattern.test(request.runId),
    "Invalid run identifier",
  );
  const repo = repository("openIndu/infra-deploy");
  const directory = join(resolve(root), ...repo.split("/"));
  mkdirSync(directory, { recursive: true });
  // Share workflow-state's mutex: lease ownership is read while this lock is held,
  // so release/reassignment cannot race the journal write.
  const mutex = join(directory, "checkpoint.lock"),
    lease = join(directory, "lease.json");
  writeFileSync(mutex, request.runId, { flag: "wx" });
  try {
    need(
      JSON.parse(readFileSync(lease, "utf8")).runId === request.runId,
      "Repository owned by another run",
    );
    const file = join(directory, "publications.json");
    const state = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { operations: {} };
    const next = publicationTransition(state, request, directory);
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`);
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
    console.log(
      JSON.stringify(
        recordPublication(
          process.argv[2],
          JSON.parse(readFileSync(process.argv[3], "utf8")),
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

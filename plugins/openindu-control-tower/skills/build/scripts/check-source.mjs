#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  artifact,
  repository,
} from "../../issue-pipeline/scripts/workflow-state.mjs";

export function checkSource(
  directory,
  manifest,
  git = (args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(),
) {
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceSha))
    throw new Error("Full source SHA required");
  const checkpoint = manifest.checkpoint;
  if (!checkpoint || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(checkpoint.taskId))
    throw new Error("Task checkpoint required");
  const state = JSON.parse(readFileSync(checkpoint.stateFile, "utf8"));
  if (state.repo !== repository(manifest.repo))
    throw new Error("Checkpoint repository mismatch");
  const task = state.tasks[checkpoint.taskId];
  if (
    task?.stages.test?.status !== "PASS" ||
    task.sourceSha !== manifest.sourceSha ||
    task.stages.test.sourceSha !== manifest.sourceSha
  )
    throw new Error("Test evidence must match source SHA");
  const taskRoot = join(
    dirname(resolve(checkpoint.stateFile)),
    "tasks",
    checkpoint.taskId,
  );
  for (const stage of ["research", "prod", "dev", "test"]) {
    const evidence = task.stages[stage]?.evidence;
    if (
      !evidence ||
      artifact(taskRoot, evidence.path).sha256 !== evidence.sha256
    )
      throw new Error("Checkpoint evidence changed or missing");
  }
  if (git(["rev-parse", "HEAD"]) !== manifest.sourceSha)
    throw new Error("Checkout differs from build source");
  if (git(["status", "--porcelain", "--untracked-files=all"]))
    throw new Error("Build source is dirty");
  if (
    git(["submodule", "status", "--recursive"])
      .split("\n")
      .some((line) => /^[+\-U]/.test(line))
  )
    throw new Error("Submodule differs from pinned source");
  if (manifest.aggregate) {
    const {
      directory: aggregateDir,
      sourceSha,
      submodulePath,
    } = manifest.aggregate;
    if (
      !/^[a-f0-9]{40}$/.test(sourceSha) ||
      !submodulePath ||
      submodulePath.startsWith("-") ||
      submodulePath.includes("..")
    )
      throw new Error("Invalid aggregate source");
    const link = execFileSync(
      "git",
      ["ls-tree", sourceSha, "--", submodulePath],
      { cwd: resolve(aggregateDir), encoding: "utf8" },
    ).trim();
    if (!link.startsWith(`160000 commit ${manifest.sourceSha}\t`))
      throw new Error("Aggregate gitlink differs from build source");
  }
  return {
    sourceSha: manifest.sourceSha,
    tag: manifest.sourceSha,
    status: "PASS",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(
      JSON.stringify(
        checkSource(
          process.argv[2],
          JSON.parse(readFileSync(process.argv[3], "utf8")),
        ),
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

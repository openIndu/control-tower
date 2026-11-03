#!/usr/bin/env node
// Version 1: read-only gate. A successful result authorizes no action by itself.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { repository } from "../../issue-pipeline/scripts/workflow-state.mjs";

export function assess(pr, checks, reviews, expectedHead, expectedBase) {
  const blockers = [];
  if (pr.state !== "OPEN" || pr.isDraft)
    blockers.push("PR is not open and ready");
  if (pr.headRefOid !== expectedHead || pr.baseRefOid !== expectedBase)
    blockers.push("Head/base changed; refresh evidence");
  if (pr.mergeable !== "MERGEABLE" || pr.mergeStateStatus !== "CLEAN")
    blockers.push("Merge state is not CLEAN/MERGEABLE");
  if (pr.reviewDecision !== "APPROVED")
    blockers.push("Current review decision is not APPROVED");
  // Require an explicit human approval of the current head, even with no review rule.
  const latest = new Map();
  for (const review of [...reviews].sort((a, b) => a.id - b.id)) {
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state))
      latest.set(review.user?.login, review);
  }
  if (
    ![...latest.values()].some(
      (r) =>
        r.state === "APPROVED" &&
        r.commit_id === expectedHead &&
        r.user?.type === "User" &&
        r.user.login !== pr.author?.login,
    )
  )
    blockers.push("No independent human approval for current head");
  if ([...latest.values()].some((r) => r.state === "CHANGES_REQUESTED"))
    blockers.push("Unresolved change request");
  if (!Array.isArray(checks) || checks.length === 0)
    blockers.push(
      "No required checks; configure an explicit required check policy",
    );
  else
    for (const check of checks.filter((c) => c.state !== "SUCCESS"))
      blockers.push(
        `Required check ${check.name ?? "unnamed"}: ${check.state}`,
      );
  return {
    eligible: blockers.length === 0,
    headSha: pr.headRefOid,
    baseSha: pr.baseRefOid,
    blockers,
  };
}
export function inspect(
  repo,
  number,
  expectedHead,
  expectedBase,
  run = (args) =>
    execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
) {
  repo = repository(repo);
  if (
    !/^\d+$/.test(String(number)) ||
    !/^[a-f0-9]{40}$/.test(expectedHead) ||
    !/^[a-f0-9]{40}$/.test(expectedBase)
  )
    throw new Error("PR number and full head/base SHA required");
  const view = () =>
    JSON.parse(
      run([
        "pr",
        "view",
        String(number),
        "--repo",
        repo,
        "--json",
        "state,isDraft,headRefOid,baseRefOid,baseRefName,mergeable,mergeStateStatus,reviewDecision,author",
      ]),
    );
  const before = view();
  const currentBase = () =>
    JSON.parse(
      run([
        "api",
        `repos/${repo}/git/ref/heads/${encodeURIComponent(before.baseRefName)}`,
      ]),
    ).object.sha;
  if (currentBase() !== expectedBase)
    throw new Error("Target branch changed; refresh base evidence");
  const protection = JSON.parse(
    run([
      "api",
      `repos/${repo}/branches/${encodeURIComponent(before.baseRefName)}/protection`,
    ]),
  );
  if (protection.required_status_checks?.strict !== true)
    throw new Error("Strict server-side required checks must be verified");
  let checkOutput;
  try {
    checkOutput = run([
      "pr",
      "checks",
      String(number),
      "--repo",
      repo,
      "--required",
      "--json",
      "name,state,link",
    ]);
  } catch (error) {
    // gh returns 1/8 for failed/pending checks while still emitting valid JSON.
    if (![1, 8].includes(error.status) || !error.stdout) throw error;
    checkOutput = String(error.stdout);
  }
  const checks = JSON.parse(checkOutput);
  const reviews = JSON.parse(
    run([
      "api",
      "--paginate",
      "--slurp",
      `repos/${repo}/pulls/${number}/reviews`,
    ]),
  ).flat();
  const after = view();
  if (
    before.headRefOid !== after.headRefOid ||
    before.baseRefOid !== after.baseRefOid ||
    currentBase() !== expectedBase
  )
    throw new Error("PR changed during inspection");
  return {
    repo,
    number: Number(number),
    ...assess(after, checks, reviews, expectedHead, expectedBase),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = inspect(...process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (!result.eligible) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

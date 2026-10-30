import { execFileSync } from "node:child_process";

import {
  detectRevertOfRecordedMerge,
  shouldTripCircuitBreaker,
} from "./circuit-breaker.mjs";
import { writePause } from "./dev-pause.mjs";

function defaultExecGh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function defaultExecGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// spec/005 section 2.3-6: "一次一个，合并后等默认分支 CI；方式固定 squash；禁止
// --admin，不改分支保护和仓库设置". --admin is never in this argv -- not filtered
// out, never added in the first place, so there is no code path that could pass it.
export function executeMerge(
  { repoPath, prNumber, headSha },
  execGh = defaultExecGh,
) {
  execGh([
    "pr",
    "merge",
    String(prNumber),
    "--squash",
    "--delete-branch",
    "--match-head-commit",
    headSha,
    "--repo",
    repoPath,
  ]);
}

function defaultFetchPrState(repoPath, prNumber, execGh = defaultExecGh) {
  const raw = execGh([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repoPath,
    "--json",
    "state,mergedAt,mergeCommit",
  ]);
  return JSON.parse(raw);
}

// spec/005 section 2.3-6: "合并后读回（状态、合并提交、树与已评审 head 一致）". Reads
// gh's own post-merge state back rather than trusting executeMerge's exit code alone
// -- the same "verify before declaring success" discipline this workspace applies to
// every external write, not something special to this module.
export function readBackMergeState(
  { repoPath, prNumber },
  fetchPrState = (repo, pr) => defaultFetchPrState(repo, pr),
) {
  const state = fetchPrState(repoPath, prNumber);
  return {
    merged: state.state === "MERGED",
    mergeCommit: state.mergeCommit?.oid ?? null,
    mergedAt: state.mergedAt ?? null,
  };
}

// The "树与已评审 head 一致" half of the same read-back: the merge commit's tree for
// the given paths must exactly match what was reviewed, not just "a merge happened".
export function verifyMergedTreeMatchesReviewed(
  { repoPath, reviewedSha, mergeCommit, paths = [] },
  execGit = defaultExecGit,
) {
  const diffOutput = execGit(
    ["diff", "--name-only", reviewedSha, mergeCommit, "--", ...paths],
    repoPath,
  );
  const differingPaths = diffOutput.split("\n").filter(Boolean);
  return { match: differingPaths.length === 0, differingPaths };
}

// Thin wiring around the stage-4 circuit-breaker decision (shouldTripCircuitBreaker):
// gathers nothing itself, just calls the existing pure function with facts the caller
// has already determined, and writes the pause file if it trips. No decision logic is
// duplicated here.
export function evaluateCircuitBreakerAfterMerge(
  facts,
  pauseFilePath,
  writePauseFn = writePause,
) {
  const verdict = shouldTripCircuitBreaker(facts);
  if (verdict.tripped) {
    writePauseFn(
      pauseFilePath,
      `circuit breaker: ${verdict.reasons.join("; ")}`,
    );
  }
  return verdict;
}

// Same wiring pattern for rollback detection (detectRevertOfRecordedMerge): any hit
// writes .dev-pause, per spec/005 section 2.3-5 ("发现即写 .dev-pause").
export function checkForRollbackAndPause(
  { defaultBranchCommitMessages, recordedMergeShas },
  pauseFilePath,
  writePauseFn = writePause,
) {
  const detected = detectRevertOfRecordedMerge(
    defaultBranchCommitMessages,
    recordedMergeShas,
  );
  if (detected.length > 0) {
    const shas = detected.map((d) => d.sha).join(", ");
    writePauseFn(
      pauseFilePath,
      `rollback detected: a revert of recorded merge(s) ${shas}`,
    );
  }
  return detected;
}

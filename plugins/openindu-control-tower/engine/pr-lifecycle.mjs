import { execFileSync } from "node:child_process";

import {
  guardG1,
  guardG2,
  guardG3,
  guardG4,
  guardG5,
  guardG6,
} from "./guards-core.mjs";
import {
  guardG7,
  guardG8,
  guardG9,
  guardG10,
  guardG11,
} from "./guards-g7-g11.mjs";

function defaultExecGh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const PR_URL_NUMBER_PATTERN = /\/pull\/(\d+)/;

// spec/005 section 2.1 step 4: "先开 draft PR". Returns the PR number parsed from gh's
// own printed URL, since `gh pr create` has no --json form across the CLI versions in
// use here -- the number is read back from what gh itself reports, not guessed.
export function openDraftPr(
  { repoPath, title, bodyFilePath, head, base = "main" },
  execGh = defaultExecGh,
) {
  const url = execGh([
    "pr",
    "create",
    "--draft",
    "--title",
    title,
    "--body-file",
    bodyFilePath,
    "--head",
    head,
    "--base",
    base,
    "--repo",
    repoPath,
  ]).trim();
  const match = url.match(PR_URL_NUMBER_PATTERN);
  if (!match)
    throw new Error(`could not parse a PR number out of gh's output: ${url}`);
  return { url, prNumber: Number(match[1]) };
}

function defaultFetchChecks(repoPath, prNumber, execGh = defaultExecGh) {
  const raw = execGh([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repoPath,
    "--json",
    "statusCheckRollup",
  ]);
  const { statusCheckRollup } = JSON.parse(raw);
  return (statusCheckRollup ?? []).map((check) => ({
    name: check.name,
    conclusion: check.conclusion,
    settled: check.status === "COMPLETED",
  }));
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls until every reported check has settled (status COMPLETED, pass or fail) or
// timeoutMs elapses. RULE 3: the loop itself is deterministic code; fetchChecks and
// sleep are both injected so a test can simulate "pending, then settled" and
// "never settles" without a single real wait.
export async function pollChecks(
  { repoPath, prNumber, intervalMs = 15000, timeoutMs = 20 * 60 * 1000 },
  {
    fetchChecks = (repo, pr) => defaultFetchChecks(repo, pr),
    sleep = defaultSleep,
  } = {},
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const checks = await fetchChecks(repoPath, prNumber);
    if (checks.length > 0 && checks.every((c) => c.settled)) {
      return { settled: true, checks };
    }
    if (Date.now() >= deadline) {
      return { settled: false, checks, timedOut: true };
    }
    await sleep(intervalMs);
  }
}

function evaluateGuards(guardFns, facts) {
  const failures = [];
  for (const guardFn of guardFns) {
    const result = guardFn(facts);
    if (!result.pass)
      failures.push({ guard: guardFn.name, reason: result.reason });
  }
  return { allPass: failures.length === 0, failures };
}

// spec/005 section 2.3-4: "先评估 G1-G6、G8-G11，全过才转 ready" -- G7 (ready/no
// conflicts/mergeable) is meaningless to check on a PR that is still draft, so it is
// deliberately excluded here and only checked in the post-promotion recheck below.
const PRE_PROMOTION_GUARDS = [
  guardG1,
  guardG2,
  guardG3,
  guardG4,
  guardG5,
  guardG6,
  guardG8,
  guardG9,
  guardG10,
  guardG11,
];

export function evaluatePromotionReadiness(facts) {
  return evaluateGuards(PRE_PROMOTION_GUARDS, facts);
}

export function promoteToReady({ repoPath, prNumber }, execGh = defaultExecGh) {
  execGh(["pr", "ready", String(prNumber), "--repo", repoPath]);
}

// spec/005 section 2.3-4: "转 ready 后重读 PR 与检查，复核 G1、G2、G7、G8、G10、G11" --
// a narrower set than the pre-promotion check, since draft->ready promotion itself can
// trigger new checks (G2/G8) or a race on mergeability (G7), but can't retroactively
// change things like declared scope (G4) or risk tier (G6).
const POST_PROMOTION_GUARDS = [
  guardG1,
  guardG2,
  guardG7,
  guardG8,
  guardG10,
  guardG11,
];

export function evaluatePostPromotionRecheck(facts) {
  return evaluateGuards(POST_PROMOTION_GUARDS, facts);
}

// spec/005 section 2.1 step 4 REASON column: "CI 失败时诊断与修复（最多 2 次）".
// attemptFix is the pluggable "diagnose and fix" step (in the real pipeline, a
// headless invoker call) -- this function only owns the deterministic retry-count
// loop around it, per RULE 3.
export async function runCiRetryLoop({ checkCi, attemptFix, maxAttempts = 2 }) {
  let result = await checkCi();
  if (result.green) return { outcome: "green", attempts: 0 };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await attemptFix(attempt);
    result = await checkCi();
    if (result.green) return { outcome: "green", attempts: attempt };
  }
  return { outcome: "exhausted", attempts: maxAttempts };
}

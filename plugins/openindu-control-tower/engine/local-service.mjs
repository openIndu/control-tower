import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// spec/005 section 2.1 step 5: "先检查「不指向生产」". Motivated by a real prior
// incident in this exact workspace (a local stack that was actually talking to a
// remote production database without anyone noticing until later) -- this is not a
// hypothetical check. Scans the resolved env text for any forbidden fragment;
// case-insensitive, since a production hostname could be miscased in different
// places without being any less dangerous.
export function checkNotPointingAtProduction(envText, forbiddenPatterns) {
  const lowerEnv = envText.toLowerCase();
  const matches = forbiddenPatterns.filter((pattern) =>
    lowerEnv.includes(pattern.toLowerCase()),
  );
  return { safe: matches.length === 0, matches };
}

function defaultExecGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// A single shared verification worktree (not one per issue -- step 5 runs once,
// after all of this run's issues have merged), pulling the CURRENT default branch.
export function createVerificationWorktree(
  { repoPath, worktreePath, defaultBranch = "main" },
  execGit = defaultExecGit,
) {
  execGit(["fetch", "origin", defaultBranch], repoPath);
  execGit(
    ["worktree", "add", worktreePath, `origin/${defaultBranch}`],
    repoPath,
  );
}

function defaultExecShellSync(command, cwd) {
  return execFileSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function defaultSpawnDetached(command, cwd) {
  const child = spawn(command, {
    cwd,
    shell: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return { pid: child.pid };
}

// Runs build_command synchronously (if given), then starts start_command detached
// -- step 5 does not block on a long-running service exiting, it starts it and
// moves on to health-probing. The production check runs BEFORE either command, per
// spec/005's own ordering ("先检查「不指向生产」"), and throws rather than returning
// a soft verdict: there is no reasonable caller that should proceed past this.
export class PointsAtProductionError extends Error {
  constructor(matches) {
    super(
      `refusing to start the local service -- env matches forbidden pattern(s): ${matches.join(", ")}`,
    );
    this.matches = matches;
  }
}

export function startLocalService(
  {
    worktreePath,
    buildCommand,
    startCommand,
    resolvedEnvText,
    forbiddenEnvPatterns,
  },
  {
    execShellSync = defaultExecShellSync,
    spawnDetached = defaultSpawnDetached,
  } = {},
) {
  const prodCheck = checkNotPointingAtProduction(
    resolvedEnvText,
    forbiddenEnvPatterns,
  );
  if (!prodCheck.safe) {
    throw new PointsAtProductionError(prodCheck.matches);
  }
  if (buildCommand) {
    execShellSync(buildCommand, worktreePath);
  }
  return spawnDetached(startCommand, worktreePath);
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls healthCheckUrl until it responds OK or a timeout elapses -- same
// settle-or-timeout shape as pr-lifecycle.mjs's pollChecks (E3), reused here rather
// than re-invented, with fetchFn/sleep both injectable so no test waits for real.
export async function probeHealth(
  { healthCheckUrl, intervalMs = 2000, timeoutMs = 60000 },
  { fetchFn = defaultFetch, sleep = defaultSleep } = {},
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetchFn(healthCheckUrl);
      if (response.ok) return { healthy: true };
    } catch {
      // connection refused / not up yet -- treated the same as a non-OK response
    }
    if (Date.now() >= deadline) return { healthy: false, timedOut: true };
    await sleep(intervalMs);
  }
}

function defaultFetch(url) {
  return fetch(url);
}

// spec/005 step 5's REASON column: "从各 issue 的验收标准生成人工验证清单".
// summarizeAcceptanceCriteria is injected (the real carrier-invocation wiring is
// assembled when dev.mjs is written, same DI pattern as F3/F4).
export async function generateVerifyChecklist(
  issues,
  summarizeAcceptanceCriteria,
) {
  const lines = ["# Manual verification checklist", ""];
  for (const issue of issues) {
    const checklistItems = await summarizeAcceptanceCriteria(issue);
    lines.push(`## Issue #${issue.number}: ${issue.title}`, "");
    for (const item of checklistItems) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function writeVerifyChecklist(path, markdownText) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdownText);
}

// A missing .env is a normal case for many repos (e.g. one that only reads
// real process env vars), not an error -- checkNotPointingAtProduction still
// runs on whatever text comes back, including "".
export function defaultReadLocalServiceEnvText(worktreePath) {
  try {
    return readFileSync(join(worktreePath, ".env"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

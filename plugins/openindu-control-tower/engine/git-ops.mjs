import { execFileSync } from "node:child_process";

// spec/005 section 2.1 step 4: "提交（署名取自 route）" -- attribution is per-repo data
// (dev.schema.json's commit.co_authored_by), never a hardcoded line and never silently
// omitted. A repo with no commit.co_authored_by configured gets a plain message with
// no trailer, which is itself the documented default ("Default: no attribution line").
export function buildCommitMessage({ subject, body, coAuthoredBy }) {
  const parts = [subject];
  if (body) parts.push(body);
  if (coAuthoredBy) parts.push(`Co-Authored-By: ${coAuthoredBy}`);
  return parts.join("\n\n");
}

function defaultExecGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// message travels as a single execFile argv element, not through a shell, so
// backticks/`$(...)`/newlines in an agent-authored commit message cannot be
// interpreted as commands -- unlike the interactive-shell `git commit -m "..."` case
// this workspace avoids by hand, this call never passes through /bin/sh or cmd.exe.
// commitChanges intentionally never stages anything itself (bare `git commit`,
// no -a) -- this is the explicit staging step step 4's real commitAndPush
// callback (PR-F8-6) runs first. Staging everything (not a declared-paths
// subset) is deliberate: G4 already re-checks the resulting diff against the
// plan's declared scope after the fact, so that is the one place "did this
// touch something it shouldn't" is decided, not duplicated here.
export function stageAllChanges(worktreePath, execGit = defaultExecGit) {
  execGit(["add", "-A"], worktreePath);
}

export function commitChanges(
  { worktreePath, message, signoff = false },
  execGit = defaultExecGit,
) {
  const args = ["commit", "-m", message];
  if (signoff) args.push("--signoff");
  execGit(args, worktreePath);
}

export function pushBranch(
  { worktreePath, branchName, remote = "origin" },
  execGit = defaultExecGit,
) {
  execGit(["push", "-u", remote, branchName], worktreePath);
}

export function currentCommitSha(worktreePath, execGit = defaultExecGit) {
  return execGit(["rev-parse", "HEAD"], worktreePath).trim();
}

// `git status --porcelain` always exits 0 whether or not there is anything
// staged, unlike `git diff --cached --quiet` (exit 1 when there IS a staged
// diff) -- deliberately avoiding throw-based control flow for a perfectly
// normal outcome (a fix role genuinely making no file change is not an
// error). Used before a CI-fix commit round: committing with nothing staged
// would throw and crash the run, when the correct behavior is to let CI
// re-poll the unchanged head and eventually exhaust its retry budget.
export function hasStagedChanges(worktreePath, execGit = defaultExecGit) {
  return execGit(["status", "--porcelain"], worktreePath).trim().length > 0;
}

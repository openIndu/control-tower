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

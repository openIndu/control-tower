import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

// spec/005 section 2.1 step 3: "每个 issue 一个独立 worktree 与分支...不碰使用者正在用
// 的检出" (one independent worktree and branch per issue; never touch the user's own
// checkout). Worktrees live under the OS temp dir by default, never inside the repo
// itself and never inside mem_docs (that is for solution/review documents, a separate
// concern -- see engine/run-state.mjs for the run-id this path is keyed on).
export function defaultWorktreeBaseDir() {
  return join(tmpdir(), "openindu-dev-runs");
}

export function issueWorktreePath({
  baseDir = defaultWorktreeBaseDir(),
  runId,
  issueNumber,
}) {
  return join(baseDir, runId, `issue-${issueNumber}`);
}

export function issueBranchName(issueNumber) {
  return `dev/issue-${issueNumber}`;
}

function defaultExecGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// Creates the worktree and its branch off baseRef in one step. repoPath is the
// orchestrator's own clone (not the user's interactive checkout); baseRef defaults to
// the remote-tracking default branch so the new branch starts from what CI last saw
// green, not from whatever happens to be checked out locally.
export function createIssueWorktree(
  { repoPath, worktreePath, branchName, baseRef = "origin/main" },
  execGit = defaultExecGit,
) {
  execGit(
    ["worktree", "add", worktreePath, "-b", branchName, baseRef],
    repoPath,
  );
}

// Known gap, stated rather than hidden: a worktree whose repo has submodules can
// reject plain `worktree remove` (the submodule's own working copy is still present
// underneath), per this workspace's own prior incident with git-worktree cleanup.
// Not every /dev-eligible repo has submodules, but this function does not special-case
// it -- a caller working with a repo it knows has submodules should check for and
// deinit them first; this function raises, it does not silently retry with --force.
export function removeIssueWorktree(
  { repoPath, worktreePath },
  execGit = defaultExecGit,
) {
  execGit(["worktree", "remove", worktreePath], repoPath);
}

export function listWorktrees(repoPath, execGit = defaultExecGit) {
  const raw = execGit(["worktree", "list", "--porcelain"], repoPath);
  const entries = [];
  let current = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length) };
      entries.push(current);
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    }
  }
  return entries;
}

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createIssueWorktree,
  defaultWorktreeBaseDir,
  issueBranchName,
  issueWorktreePath,
  listWorktrees,
  removeIssueWorktree,
} from "./worktree.mjs";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

// A real local clone with one commit on main, standing in for the orchestrator's own
// checkout of a target repo -- the "本地裸仓" fixture approach spec/005 section 4
// stage 6 names, not a mock of git itself.
function makeLocalRepoWithOneCommit(dir) {
  git(["init", "-q", "-b", "main", dir], undefined);
  writeFileSync(join(dir, "README.md"), "hello\n");
  git(["add", "."], dir);
  git(
    [
      "-c",
      "user.email=t@example.com",
      "-c",
      "user.name=t",
      "commit",
      "-q",
      "-m",
      "init",
    ],
    dir,
  );
}

test("issueWorktreePath and issueBranchName produce the expected per-issue shapes", () => {
  const p = issueWorktreePath({
    baseDir: "/tmp/base",
    runId: "run-1",
    issueNumber: 42,
  });
  assert.equal(p, join("/tmp/base", "run-1", "issue-42"));
  assert.equal(issueBranchName(42), "dev/issue-42");
});

test("defaultWorktreeBaseDir is under the OS temp dir, not inside any repo", () => {
  assert.ok(defaultWorktreeBaseDir().startsWith(tmpdir()));
});

test("createIssueWorktree creates a real worktree on a new branch off origin/main-equivalent ref", () => {
  const scratch = mkdtempSync(join(tmpdir(), "worktree-test-"));
  try {
    const repoPath = join(scratch, "repo");
    makeLocalRepoWithOneCommit(repoPath);
    const worktreePath = join(scratch, "wt-issue-7");
    createIssueWorktree(
      { repoPath, worktreePath, branchName: "dev/issue-7", baseRef: "main" },
      (args, cwd) => git(args, cwd),
    );
    assert.ok(existsSync(join(worktreePath, "README.md")));
    const branch = git(["branch", "--show-current"], worktreePath).trim();
    assert.equal(branch, "dev/issue-7");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("listWorktrees reports the created worktree with its branch", () => {
  const scratch = mkdtempSync(join(tmpdir(), "worktree-test-"));
  try {
    const repoPath = join(scratch, "repo");
    makeLocalRepoWithOneCommit(repoPath);
    const worktreePath = join(scratch, "wt-issue-9");
    createIssueWorktree(
      { repoPath, worktreePath, branchName: "dev/issue-9", baseRef: "main" },
      (args, cwd) => git(args, cwd),
    );
    const entries = listWorktrees(repoPath, (args, cwd) => git(args, cwd));
    const match = entries.find((e) => e.path.endsWith("wt-issue-9"));
    assert.ok(match, "expected to find the created worktree in the listing");
    assert.equal(match.branch, "refs/heads/dev/issue-9");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("removeIssueWorktree removes a clean worktree and listWorktrees no longer reports it", () => {
  const scratch = mkdtempSync(join(tmpdir(), "worktree-test-"));
  try {
    const repoPath = join(scratch, "repo");
    makeLocalRepoWithOneCommit(repoPath);
    const worktreePath = join(scratch, "wt-issue-11");
    createIssueWorktree(
      { repoPath, worktreePath, branchName: "dev/issue-11", baseRef: "main" },
      (args, cwd) => git(args, cwd),
    );
    removeIssueWorktree({ repoPath, worktreePath }, (args, cwd) =>
      git(args, cwd),
    );
    assert.equal(existsSync(worktreePath), false);
    const entries = listWorktrees(repoPath, (args, cwd) => git(args, cwd));
    assert.ok(!entries.some((e) => e.path.endsWith("wt-issue-11")));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("removeIssueWorktree propagates git's own error instead of silently retrying with --force", () => {
  const scratch = mkdtempSync(join(tmpdir(), "worktree-test-"));
  try {
    const repoPath = join(scratch, "repo");
    makeLocalRepoWithOneCommit(repoPath);
    assert.throws(() => {
      removeIssueWorktree(
        { repoPath, worktreePath: join(scratch, "never-created") },
        (args, cwd) => git(args, cwd),
      );
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

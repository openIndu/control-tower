import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildCommitMessage,
  commitChanges,
  currentCommitSha,
  pushBranch,
  stageAllChanges,
} from "./git-ops.mjs";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

test("buildCommitMessage with no coAuthoredBy omits the trailer entirely", () => {
  const msg = buildCommitMessage({ subject: "fix: thing" });
  assert.equal(msg, "fix: thing");
  assert.ok(!msg.includes("Co-Authored-By"));
});

test("buildCommitMessage with coAuthoredBy appends it as its own trailer paragraph", () => {
  const msg = buildCommitMessage({
    subject: "fix: thing",
    body: "Longer explanation.",
    coAuthoredBy: "Claude Sonnet 5 <noreply@anthropic.com>",
  });
  assert.equal(
    msg,
    "fix: thing\n\nLonger explanation.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>",
  );
});

test("a commit message containing shell metacharacters is committed verbatim, not interpreted", () => {
  const scratch = mkdtempSync(join(tmpdir(), "git-ops-test-"));
  try {
    git(["init", "-q", "-b", "main", scratch]);
    writeFileSync(join(scratch, "f.txt"), "x\n");
    git(["add", "."], scratch);
    git(
      ["-c", "user.email=t@example.com", "-c", "user.name=t", "add", "."],
      scratch,
    );
    const dangerous = "fix: $(touch /tmp/should-not-exist) and `echo pwned`";
    commitChanges({ worktreePath: scratch, message: dangerous }, (args, cwd) =>
      execFileSync(
        "git",
        ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
        {
          cwd,
          encoding: "utf8",
        },
      ),
    );
    const logged = git(["log", "-1", "--format=%B"], scratch).trim();
    assert.equal(logged, dangerous);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("commitChanges with signoff adds a Signed-off-by trailer", () => {
  const scratch = mkdtempSync(join(tmpdir(), "git-ops-test-"));
  try {
    git(["init", "-q", "-b", "main", scratch]);
    writeFileSync(join(scratch, "f.txt"), "x\n");
    const execGit = (args, cwd) =>
      execFileSync(
        "git",
        ["-c", "user.email=t@example.com", "-c", "user.name=Tester", ...args],
        { cwd, encoding: "utf8" },
      );
    execGit(["add", "."], scratch);
    commitChanges(
      { worktreePath: scratch, message: "feat: x", signoff: true },
      execGit,
    );
    const logged = git(["log", "-1", "--format=%B"], scratch);
    assert.ok(logged.includes("Signed-off-by: Tester <t@example.com>"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("stageAllChanges stages every untracked and modified file, not a subset", () => {
  const scratch = mkdtempSync(join(tmpdir(), "git-ops-test-"));
  try {
    git(["init", "-q", "-b", "main", scratch]);
    const execGit = (args, cwd) =>
      execFileSync(
        "git",
        ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
        { cwd, encoding: "utf8" },
      );
    writeFileSync(join(scratch, "a.txt"), "a\n");
    execGit(["add", "."], scratch);
    execGit(["commit", "-q", "-m", "init"], scratch);
    writeFileSync(join(scratch, "a.txt"), "a changed\n");
    writeFileSync(join(scratch, "b.txt"), "b\n");

    stageAllChanges(scratch, execGit);

    const staged = execGit(["diff", "--cached", "--name-only"], scratch)
      .trim()
      .split("\n")
      .sort();
    assert.deepEqual(staged, ["a.txt", "b.txt"]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("pushBranch pushes the current branch to a local bare remote, and currentCommitSha matches what landed there", () => {
  const scratch = mkdtempSync(join(tmpdir(), "git-ops-test-"));
  try {
    const bareRemote = join(scratch, "remote.git");
    git(["init", "-q", "--bare", "-b", "main", bareRemote]);
    const clonePath = join(scratch, "clone");
    git(["clone", "-q", bareRemote, clonePath]);
    writeFileSync(join(clonePath, "f.txt"), "x\n");
    const execGit = (args, cwd) =>
      execFileSync(
        "git",
        ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
        { cwd, encoding: "utf8" },
      );
    execGit(["add", "."], clonePath);
    execGit(["commit", "-q", "-m", "init"], clonePath);
    execGit(["checkout", "-q", "-b", "dev/issue-1"], clonePath);
    const sha = currentCommitSha(clonePath, execGit);

    pushBranch({ worktreePath: clonePath, branchName: "dev/issue-1" }, execGit);

    const remoteBranches = execFileSync("git", ["branch"], {
      cwd: bareRemote,
      encoding: "utf8",
    });
    assert.ok(remoteBranches.includes("dev/issue-1"));
    const remoteSha = execFileSync("git", ["rev-parse", "dev/issue-1"], {
      cwd: bareRemote,
      encoding: "utf8",
    }).trim();
    assert.equal(remoteSha, sha);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

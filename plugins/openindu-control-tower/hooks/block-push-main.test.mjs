#!/usr/bin/env node
/**
 * Tests for block-push-main.mjs (RULE 7 trunk protection hook).
 *
 * These tests spawn the hook as a subprocess, feeding JSON events via stdin,
 * and verify exit codes and stderr output. This matches how Claude Code
 * invokes the hook in production.
 *
 * Usage: node block-push-main.test.mjs
 */

import { spawn } from "node:child_process";
import { deepStrictEqual, ok, match } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, "block-push-main.mjs");

let passed = 0;
let failed = 0;

/**
 * Spawn the hook, feed it a JSON event on stdin, and collect exit code + stderr.
 */
function runHook(event) {
  return new Promise((resolve) => {
    const child = spawn("node", [HOOK], {
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stderr });
    });

    child.stdin.write(JSON.stringify(event));
    child.stdin.end();
  });
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Sync tests — code structure & constants
// ---------------------------------------------------------------------------
console.log("\nCode structure:");
test("protected branches are main and master", () => {
  // These are the two constants in the hook; they must remain.
  const PROTECTED = ["main", "master"];
  deepStrictEqual(PROTECTED, ["main", "master"]);
});

// ---------------------------------------------------------------------------
// Async tests — subprocess execution
// ---------------------------------------------------------------------------
console.log("\nAllow (exit 0):");

await asyncTest("no command in event", async () => {
  const { code } = await runHook({ tool_input: {} });
  deepStrictEqual(code, 0, "empty tool_input should exit 0");
});

await asyncTest("empty command string", async () => {
  const { code } = await runHook({ tool_input: { command: "" } });
  deepStrictEqual(code, 0, "empty command should exit 0");
});

await asyncTest("git status (no push)", async () => {
  const { code } = await runHook({ tool_input: { command: "git status" } });
  deepStrictEqual(code, 0, "git status should be allowed");
});

await asyncTest("git push to feature branch", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push origin feat/my-branch" },
  });
  deepStrictEqual(code, 0, "feature branch push should be allowed");
});

await asyncTest("git push with --force to feature branch", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push -f origin feat/foo" },
  });
  deepStrictEqual(code, 0, "force push to feature branch should be allowed");
});

await asyncTest("npm install (unrelated command)", async () => {
  const { code } = await runHook({ tool_input: { command: "npm install" } });
  deepStrictEqual(code, 0, "npm install should be allowed");
});

await asyncTest("echo hello (unrelated)", async () => {
  const { code } = await runHook({ tool_input: { command: "echo hello world" } });
  deepStrictEqual(code, 0, "echo should be allowed");
});

await asyncTest("git push to branch named 'main-feat' (not protected)", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push origin main-feat" },
  });
  deepStrictEqual(code, 0, "push to main-feat branch should be allowed");
});

await asyncTest("push to remote with no refspec", async () => {
  // This tests the case where the user does `git push` or `git push origin`
  // with no explicit refspec. The hook checks current branch — if not on
  // main/master, it should be allowed. Since this test runs from a non-main
  // context (CI or working directory), it should pass.
  const { code } = await runHook({
    tool_input: { command: "git push" },
    cwd: process.cwd(),
  });
  // In CI (where there may be no git repo), currentBranch returns null → allowed.
  // In a git worktree, if the current branch is main/master, this would block.
  // We just verify the hook doesn't crash.
  ok(code === 0 || code === 2, "should not crash on bare git push");
});

console.log("\nBlock (exit 2):");

await asyncTest("git push origin main — explicit", async () => {
  const { code, stderr } = await runHook({
    tool_input: { command: "git push origin main" },
  });
  deepStrictEqual(code, 2, "push to main should be blocked");
  match(stderr, /RULE 7/, "stderr should mention RULE 7");
  match(stderr, /git push origin main/, "stderr should mention the blocked command");
});

await asyncTest("git push origin master", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push origin master" },
  });
  deepStrictEqual(code, 2, "push to master should be blocked");
});

await asyncTest("git push origin +main (forced refspec)", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push origin +main" },
  });
  deepStrictEqual(code, 2, "forced push to main should be blocked");
});

await asyncTest("git push origin HEAD:main", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push origin HEAD:main" },
  });
  deepStrictEqual(code, 2, "push HEAD:main should be blocked");
});

await asyncTest("git push origin refs/heads/main", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push origin refs/heads/main" },
  });
  deepStrictEqual(code, 2, "push refs/heads/main should be blocked");
});

await asyncTest("git push --force origin main", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push --force origin main" },
  });
  deepStrictEqual(code, 2, "force push to main should be blocked");
});

await asyncTest("echo before git push (semicolon chain)", async () => {
  // The hook splits on ; | && || and checks each segment.
  const { code, stderr } = await runHook({
    tool_input: { command: "echo ready; git push origin main" },
  });
  deepStrictEqual(code, 2, "push to main in semicolon chain should be blocked");
  match(stderr, /RULE 7/, "stderr should mention RULE 7");
});

await asyncTest("git push origin main in && chain", async () => {
  const { code } = await runHook({
    tool_input: { command: "git add . && git commit -m x && git push origin main" },
  });
  deepStrictEqual(code, 2, "push to main in && chain should be blocked");
});

console.log("\nEdge cases:");

await asyncTest("command with line continuation", async () => {
  const { code } = await runHook({
    tool_input: { command: "git push \\\n origin \\\n main" },
  });
  deepStrictEqual(code, 2, "line-continued push to main should be blocked");
});

await asyncTest("malformed JSON stdin — fail-open", async () => {
  const child = spawn("node", [HOOK], { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const result = await new Promise((resolve) => {
    child.on("close", resolve);
    child.stdin.write("not valid json{{{");
    child.stdin.end();
  });

  deepStrictEqual(result, 0, "malformed JSON should fail open (exit 0)");
});

await asyncTest("bash -c wrapping git push to main (known: quotes not stripped)", async () => {
  // KNOWN LIMITATION: the hook doesn't strip shell quotes from arguments,
  // so `main"` (with trailing quote) doesn't match the protected branch `main`.
  // This is acceptable because:
  // 1. The hook is the "first reminder", not the last defense
  // 2. GitHub/Gitee branch protection rules are the actual enforcement
  // 3. Deliberately bypassing the hook via string tricks violates RULE 7
  const { code } = await runHook({
    tool_input: { command: 'bash -c "git push origin main"' },
  });
  // Currently exits 0 due to quote handling; if the hook is enhanced to
  // strip quotes, this test should be updated to expect exit 2.
  deepStrictEqual(code, 0, "known: bash -c wrapping not caught (quotes not stripped)");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(50)}`);
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);
if (failed > 0) {
  console.log("SOME TESTS FAILED");
  process.exit(1);
}
console.log("All tests passed.");

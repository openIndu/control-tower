import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  checkNotPointingAtProduction,
  createVerificationWorktree,
  generateVerifyChecklist,
  PointsAtProductionError,
  probeHealth,
  startLocalService,
  writeVerifyChecklist,
} from "./local-service.mjs";

test("checkNotPointingAtProduction is safe when nothing in the env matches a forbidden pattern", () => {
  const result = checkNotPointingAtProduction(
    "DATABASE_URL=postgres://localhost:5432/dev\n",
    ["prod-db.internal", "prod.openindu"],
  );
  assert.deepEqual(result, { safe: true, matches: [] });
});

test("checkNotPointingAtProduction catches a production hostname and names it in matches", () => {
  const result = checkNotPointingAtProduction(
    "DATABASE_URL=postgres://prod-db.internal:5432/app\n",
    ["prod-db.internal", "prod.openindu"],
  );
  assert.equal(result.safe, false);
  assert.deepEqual(result.matches, ["prod-db.internal"]);
});

test("checkNotPointingAtProduction matches case-insensitively", () => {
  const result = checkNotPointingAtProduction("HOST=PROD-DB.INTERNAL\n", [
    "prod-db.internal",
  ]);
  assert.equal(result.safe, false);
});

test("createVerificationWorktree fetches the default branch then adds a worktree tracking origin/<branch>", () => {
  const calls = [];
  createVerificationWorktree(
    {
      repoPath: "/fake/repo",
      worktreePath: "/fake/verify-wt",
      defaultBranch: "main",
    },
    (args, cwd) => {
      calls.push({ args, cwd });
    },
  );
  assert.deepEqual(calls[0].args, ["fetch", "origin", "main"]);
  assert.deepEqual(calls[1].args, [
    "worktree",
    "add",
    "/fake/verify-wt",
    "origin/main",
  ]);
});

test("startLocalService throws PointsAtProductionError BEFORE running build or start when the env is unsafe", () => {
  const calls = [];
  assert.throws(
    () =>
      startLocalService(
        {
          worktreePath: "/fake",
          buildCommand: "npm run build",
          startCommand: "npm start",
          resolvedEnvText: "DATABASE_URL=prod-db.internal",
          forbiddenEnvPatterns: ["prod-db.internal"],
        },
        {
          execShellSync: () => calls.push("build"),
          spawnDetached: () => calls.push("start"),
        },
      ),
    PointsAtProductionError,
  );
  assert.deepEqual(
    calls,
    [],
    "neither build nor start must run when the production check fails",
  );
});

test("startLocalService runs build then start, in that order, when the env is safe", () => {
  const calls = [];
  const result = startLocalService(
    {
      worktreePath: "/fake",
      buildCommand: "npm run build",
      startCommand: "npm start",
      resolvedEnvText: "DATABASE_URL=localhost",
      forbiddenEnvPatterns: ["prod-db.internal"],
    },
    {
      execShellSync: (cmd) => calls.push(`build:${cmd}`),
      spawnDetached: (cmd) => {
        calls.push(`start:${cmd}`);
        return { pid: 1234 };
      },
    },
  );
  assert.deepEqual(calls, ["build:npm run build", "start:npm start"]);
  assert.equal(result.pid, 1234);
});

test("startLocalService with no buildCommand skips the build step but still starts", () => {
  const calls = [];
  startLocalService(
    {
      worktreePath: "/fake",
      buildCommand: undefined,
      startCommand: "npm start",
      resolvedEnvText: "safe",
      forbiddenEnvPatterns: [],
    },
    {
      execShellSync: () => calls.push("build"),
      spawnDetached: (cmd) => {
        calls.push(`start:${cmd}`);
        return { pid: 1 };
      },
    },
  );
  assert.deepEqual(calls, ["start:npm start"]);
});

test("probeHealth returns healthy:true immediately once fetchFn reports ok, without sleeping", async () => {
  let sleepCalls = 0;
  const result = await probeHealth(
    { healthCheckUrl: "http://localhost:8080/health" },
    { fetchFn: async () => ({ ok: true }), sleep: async () => sleepCalls++ },
  );
  assert.deepEqual(result, { healthy: true });
  assert.equal(sleepCalls, 0);
});

test("probeHealth retries through a connection-refused throw and a non-ok response before succeeding", async () => {
  let call = 0;
  const result = await probeHealth(
    { healthCheckUrl: "http://localhost:8080/health", timeoutMs: 999999 },
    {
      fetchFn: async () => {
        call++;
        if (call === 1) throw new Error("ECONNREFUSED");
        if (call === 2) return { ok: false };
        return { ok: true };
      },
      sleep: async () => {},
    },
  );
  assert.equal(result.healthy, true);
  assert.equal(call, 3);
});

test("probeHealth times out and reports healthy:false when the service never comes up", async () => {
  let now = 0;
  const realDateNow = Date.now;
  Date.now = () => now;
  try {
    const result = await probeHealth(
      { healthCheckUrl: "http://localhost:8080/health", timeoutMs: 100 },
      {
        fetchFn: async () => ({ ok: false }),
        sleep: async () => {
          now += 1000;
        },
      },
    );
    assert.deepEqual(result, { healthy: false, timedOut: true });
  } finally {
    Date.now = realDateNow;
  }
});

test("generateVerifyChecklist renders a checklist section per issue from the injected summarizer", async () => {
  const markdown = await generateVerifyChecklist(
    [
      { number: 76, title: "Studio local build" },
      { number: 80, title: "Fix login redirect" },
    ],
    async (issue) =>
      issue.number === 76
        ? ["Build completes with no errors", "App boots"]
        : ["Login redirects correctly"],
  );
  assert.match(markdown, /## Issue #76: Studio local build/);
  assert.match(markdown, /- \[ \] Build completes with no errors/);
  assert.match(markdown, /## Issue #80: Fix login redirect/);
  assert.match(markdown, /- \[ \] Login redirects correctly/);
});

test("writeVerifyChecklist writes the markdown text to the given path, creating directories as needed", () => {
  const dir = mkdtempSync(join(tmpdir(), "local-service-test-"));
  try {
    const path = join(dir, "nested", "verify-checklist.md");
    writeVerifyChecklist(path, "# Checklist\n\n- [ ] thing\n");
    assert.equal(readFileSync(path, "utf8"), "# Checklist\n\n- [ ] thing\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

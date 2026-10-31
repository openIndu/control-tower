import assert from "node:assert/strict";
import test from "node:test";

import { buildRepoRunContext } from "./run-context.mjs";

const BASE_ARGS = {
  org: "openIndu",
  repo: "widget-service",
  baseRef: "origin/main",
  defaultBranch: "main",
  docsDir: "/docs",
  controlTowerRepoPath: "/ct",
  controlTowerRef: "main",
  grantPrincipleRef: "main",
};

test("buildRepoRunContext reads commit config and publishesOnMerge from repoEntry.dev using dev.schema.json's exact field names", () => {
  const context = buildRepoRunContext(
    {
      ...BASE_ARGS,
      repoEntry: {
        dev: {
          commit: { co_authored_by: "Claude <noreply@x>", signoff: true },
          publishes_on_merge: true,
        },
      },
    },
    { resolveApprovers: () => ["@alice"] },
  );

  assert.deepEqual(context.commit, {
    coAuthoredBy: "Claude <noreply@x>",
    signoff: true,
  });
  assert.equal(context.publishesOnMerge, true);
});

test("buildRepoRunContext defaults commit/publishesOnMerge safely when repoEntry.dev has neither field", () => {
  const context = buildRepoRunContext(
    { ...BASE_ARGS, repoEntry: { dev: {} } },
    { resolveApprovers: () => [] },
  );

  assert.deepEqual(context.commit, { coAuthoredBy: null, signoff: false });
  assert.equal(context.publishesOnMerge, false);
});

test("buildRepoRunContext resolves authorizedApprovers exactly once via the injected resolver, scoped to org+repo", () => {
  let callCount = 0;
  let seenArgs = null;
  const context = buildRepoRunContext(
    { ...BASE_ARGS, repoEntry: { dev: {} } },
    {
      resolveApprovers: (args) => {
        callCount += 1;
        seenArgs = args;
        return ["@bob", "@carol"];
      },
    },
  );

  assert.equal(callCount, 1);
  assert.deepEqual(seenArgs, { org: "openIndu", repo: "widget-service" });
  assert.deepEqual(context.authorizedApprovers, ["@bob", "@carol"]);
});

test("buildRepoRunContext has no resumePrNumber field -- that is a per-issue override the caller applies separately", () => {
  const context = buildRepoRunContext(
    { ...BASE_ARGS, repoEntry: { dev: {} } },
    { resolveApprovers: () => [] },
  );

  assert.equal("resumePrNumber" in context, false);
});

test("buildRepoRunContext initializes circuit-breaker facts to their safe/false starting state", () => {
  const context = buildRepoRunContext(
    { ...BASE_ARGS, repoEntry: { dev: {} } },
    { resolveApprovers: () => [] },
  );

  assert.deepEqual(context.recordedMergeShas, []);
  assert.equal(context.twoConsecutiveBlockedIssues, false);
  assert.equal(context.repeatedToolErrors, false);
});

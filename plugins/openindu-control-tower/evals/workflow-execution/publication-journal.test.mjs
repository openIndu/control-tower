import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  publicationTransition,
  recordPublication,
} from "../../skills/publish/scripts/publish-journal.mjs";

const sha = "a".repeat(40),
  baseSha = "b".repeat(40),
  image = `registry.example/openindu/app@sha256:${"c".repeat(64)}`;
function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "publish-journal-"));
  const repo = join(root, "openindu", "infra-deploy");
  mkdirSync(repo, { recursive: true });
  writeFileSync(join(repo, "evidence.txt"), "verified gitee read-back\n");
  writeFileSync(join(repo, "lease.json"), JSON.stringify({ runId: "run-1" }));
  try {
    return fn({ root, repo });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const intent = {
  runId: "run-1",
  action: "intent",
  key: "release-1",
  sourceRepo: "openIndu/app",
  taskId: "task-1",
  sourceSha: sha,
  headSha: sha,
  branch: "release/20261103-task-1",
  baseBranch: "main",
  baseSha,
  image,
  artifact: "evidence.txt",
};
const applied = {
  runId: "run-1",
  action: "reconcile",
  key: "release-1",
  result: "APPLIED",
  reason: "Gitee read-back verified",
  prId: 42,
  url: "https://gitee.com/openindu/infra-deploy/pulls/42",
  actualBranch: intent.branch,
  actualBaseBranch: "main",
  actualBaseSha: baseSha,
  actualHeadSha: sha,
  actualImage: image,
  artifact: "evidence.txt",
};

test("publication requires explicit branch and base binding", () =>
  fixture(({ repo }) => {
    const state = publicationTransition({ operations: {} }, intent, repo);
    for (const change of [
      { actualBranch: "release/wrong" },
      { actualBaseBranch: "develop" },
    ]) {
      assert.throws(
        () => publicationTransition(state, { ...applied, ...change }, repo),
        /branch read-back mismatch/,
      );
    }
    assert.throws(
      () =>
        publicationTransition(
          state,
          { ...applied, actualBaseSha: "d".repeat(40) },
          repo,
        ),
      /base moved/,
    );
  }));

test("APPLIED is sticky and cannot be downgraded or replayed", () =>
  fixture(({ repo }) => {
    const first = publicationTransition({ operations: {} }, intent, repo);
    const done = publicationTransition(first, applied, repo);
    assert.throws(
      () =>
        publicationTransition(
          done,
          { ...applied, result: "NOT_APPLIED" },
          repo,
        ),
      /cannot be downgraded/,
    );
    assert.throws(
      () => publicationTransition(done, { ...intent, key: "release-2" }, repo),
      /Existing publication/,
    );
    const independent = publicationTransition(
      done,
      {
        ...intent,
        key: "release-2",
        taskId: "task-2",
        sourceSha: "d".repeat(40),
        headSha: "e".repeat(40),
        branch: "release/20261103-task-2",
        image: `registry.example/openindu/other@sha256:${"f".repeat(64)}`,
      },
      repo,
    );
    assert.equal(independent.operations["release-2"].state, "PENDING");
  }));

test("moved base can be re-read and reconciled on the same existing PR", () =>
  fixture(({ repo }) => {
    const first = publicationTransition({ operations: {} }, intent, repo);
    const movedBase = "d".repeat(40);
    const blocked = publicationTransition(
      first,
      {
        ...applied,
        result: "BLOCKED",
        reason: "Gitee base advanced; existing PR retained",
        actualBaseSha: movedBase,
      },
      repo,
    );
    assert.equal(blocked.operations["release-1"].prId, applied.prId);
    const refreshed = publicationTransition(
      blocked,
      {
        ...applied,
        action: "refresh_base",
        reason: "Same PR re-read against current default branch",
        actualBaseSha: movedBase,
      },
      repo,
    );
    assert.equal(refreshed.operations["release-1"].prId, applied.prId);
    assert.equal(refreshed.operations["release-1"].state, "PENDING");
    const done = publicationTransition(
      refreshed,
      { ...applied, actualBaseSha: movedBase },
      repo,
    );
    assert.equal(done.operations["release-1"].state, "APPLIED");
    assert.equal(done.operations["release-1"].readBackHistory.length, 3);
  }));

test("a known PR cannot be marked absent or replayed under another key", () =>
  fixture(({ repo }) => {
    const first = publicationTransition({ operations: {} }, intent, repo);
    const blocked = publicationTransition(
      first,
      {
        ...applied,
        result: "BLOCKED",
        reason: "base moved after PR creation",
        actualBaseSha: "d".repeat(40),
      },
      repo,
    );
    assert.throws(
      () =>
        publicationTransition(
          blocked,
          {
            ...applied,
            result: "NOT_APPLIED",
            reason: "incorrect absence claim",
          },
          repo,
        ),
      /existing PR cannot be marked absent/,
    );
    assert.throws(
      () =>
        publicationTransition(blocked, { ...intent, key: "release-2" }, repo),
      /Existing publication/,
    );
  }));

test("read-back observations append without overwriting history", () =>
  fixture(({ repo }) => {
    const first = publicationTransition({ operations: {} }, intent, repo);
    const blocked = publicationTransition(
      first,
      {
        ...applied,
        result: "BLOCKED",
        reason: "temporary read issue",
        prId: undefined,
        url: undefined,
        actualBranch: undefined,
        actualBaseBranch: undefined,
        actualBaseSha: undefined,
        actualHeadSha: undefined,
        actualImage: undefined,
      },
      repo,
    );
    const done = publicationTransition(blocked, applied, repo);
    const history = done.operations["release-1"].readBackHistory;
    assert.equal(history.length, 2);
    assert.equal(history[0].reason, "temporary read issue");
    assert.equal(history[1].prId, 42);
  }));

test("journal shares checkpoint lock and validates lease ownership", () =>
  fixture(({ root, repo }) => {
    writeFileSync(join(repo, "checkpoint.lock"), "another-run");
    assert.throws(() => recordPublication(root, intent), /EEXIST/);
    rmSync(join(repo, "checkpoint.lock"));
    writeFileSync(
      join(repo, "lease.json"),
      JSON.stringify({ runId: "other-run" }),
    );
    assert.throws(
      () => recordPublication(root, intent),
      /owned by another run/,
    );
  }));

test("dry-run rejects before creating repository state", () =>
  fixture(({ root }) => {
    const fresh = join(root, "fresh");
    assert.throws(
      () => recordPublication(fresh, { ...intent, dryRun: true }),
      /Dry-run/,
    );
    assert.equal(existsSync(fresh), false);
  }));

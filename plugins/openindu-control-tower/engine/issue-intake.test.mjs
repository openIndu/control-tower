import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildSnapshot,
  buildSnapshotEntry,
  checkSourcePermissions,
  formatZeroIssuesReport,
  writeSnapshot,
} from "./issue-intake.mjs";

test("checkSourcePermissions reports the author and every commenter's write access independently", () => {
  const writers = new Set(["alice"]);
  const result = checkSourcePermissions(
    {
      repoPath: "openIndu/control-tower",
      authorLogin: "alice",
      commenterLogins: ["bob", "alice"],
    },
    (repoPath, login) => {
      assert.equal(repoPath, "openIndu/control-tower");
      return writers.has(login);
    },
  );
  assert.equal(result.issueAuthorHasWrite, true);
  assert.deepEqual(result.commenterPermissions, [
    { login: "bob", hasWrite: false },
    { login: "alice", hasWrite: true },
  ]);
});

test("checkSourcePermissions with no commenters returns an empty commenterPermissions array", () => {
  const result = checkSourcePermissions(
    { repoPath: "r", authorLogin: "alice", commenterLogins: [] },
    () => true,
  );
  assert.deepEqual(result.commenterPermissions, []);
});

test("buildSnapshotEntry attaches a body hash that changes when the body changes", () => {
  const entry1 = buildSnapshotEntry(
    { number: 76, body: "original text" },
    { issueAuthorHasWrite: true },
  );
  const entry2 = buildSnapshotEntry(
    { number: 76, body: "edited text" },
    { issueAuthorHasWrite: true },
  );
  assert.notEqual(entry1.bodyHashAtSnapshot, entry2.bodyHashAtSnapshot);
  assert.equal(entry1.number, 76);
  assert.equal(entry1.source.issueAuthorHasWrite, true);
});

test("buildSnapshotEntry's hash is stable for the same body text", () => {
  const entry1 = buildSnapshotEntry({ body: "same" }, {});
  const entry2 = buildSnapshotEntry({ body: "same" }, {});
  assert.equal(entry1.bodyHashAtSnapshot, entry2.bodyHashAtSnapshot);
});

test("buildSnapshot wraps a list of issues with a takenAt timestamp and issueCount", () => {
  const snapshot = buildSnapshot([
    {
      issue: { number: 1, body: "a" },
      sourceFacts: { issueAuthorHasWrite: true },
    },
    {
      issue: { number: 2, body: "b" },
      sourceFacts: { issueAuthorHasWrite: false },
    },
  ]);
  assert.equal(snapshot.issueCount, 2);
  assert.equal(snapshot.issues.length, 2);
  assert.equal(snapshot.issues[0].number, 1);
  assert.equal(typeof snapshot.takenAt, "string");
});

test("writeSnapshot then reading the file back round-trips the snapshot exactly", () => {
  const dir = mkdtempSync(join(tmpdir(), "issue-intake-test-"));
  try {
    const snapshot = buildSnapshot([
      {
        issue: { number: 76, body: "x" },
        sourceFacts: { issueAuthorHasWrite: true },
      },
    ]);
    const path = join(dir, "nested", "snapshot.json");
    writeSnapshot(path, snapshot);
    const loaded = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(loaded, snapshot);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("formatZeroIssuesReport names the repo and says 0 项", () => {
  const report = formatZeroIssuesReport("openindu-studio");
  assert.match(report, /0 项/);
  assert.match(report, /openindu-studio/);
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  computeBodyHash,
  guardG10,
  guardG11,
  guardG7,
  guardG8,
  guardG9,
} from "./guards-g7-g11.mjs";
import { writePause } from "./dev-pause.mjs";

// --- G7 ----------------------------------------------------------------
const cleanG7 = { isReady: true, hasConflicts: false, isMergeable: true };
test("G7 passes when ready, conflict-free and mergeable", () =>
  assert.equal(guardG7(cleanG7).pass, true));
test("G7 fails while still draft", () =>
  assert.equal(guardG7({ ...cleanG7, isReady: false }).pass, false));
test("G7 fails with conflicts even if marked mergeable", () =>
  assert.equal(guardG7({ ...cleanG7, hasConflicts: true }).pass, false));
test("G7 fails when not mergeable", () =>
  assert.equal(guardG7({ ...cleanG7, isMergeable: false }).pass, false));

// --- G8 ----------------------------------------------------------------
const cleanG8 = { defaultBranchHeadConclusion: "SUCCESS", prIncludesDefaultBranchHead: true };
test("G8 passes when the default branch HEAD is green and the PR includes it", () =>
  assert.equal(guardG8(cleanG8).pass, true));
test("G8 fails when the default branch HEAD is not green", () =>
  assert.equal(guardG8({ ...cleanG8, defaultBranchHeadConclusion: "PENDING" }).pass, false));
test("G8 fails when the PR does not yet include the default branch HEAD", () =>
  assert.equal(guardG8({ ...cleanG8, prIncludesDefaultBranchHead: false }).pass, false));

// --- G9 ----------------------------------------------------------------
test("G9 passes when every CODEOWNERS owner for the changed paths is an authorized approver", () =>
  assert.equal(
    guardG9({
      changedPaths: ["engine/a.mjs"],
      codeownersText: "engine/*.mjs @alice\n",
      authorizedApprovers: ["@alice", "@bob"],
    }).pass,
    true,
  ));
test("G9 fails when CODEOWNERS names someone outside the authorized-approver roster", () =>
  assert.equal(
    guardG9({
      changedPaths: ["engine/a.mjs"],
      codeownersText: "engine/*.mjs @outsider\n",
      authorizedApprovers: ["@alice", "@bob"],
    }).pass,
    false,
  ));
test("G9 passes when no CODEOWNERS entry covers the changed paths at all", () =>
  assert.equal(
    guardG9({
      changedPaths: ["README.md"],
      codeownersText: "engine/*.mjs @alice\n",
      authorizedApprovers: ["@alice"],
    }).pass,
    true,
  ));

// --- computeBodyHash / G10 ---------------------------------------------
test("computeBodyHash is stable for the same text and differs for different text", () => {
  const h1 = computeBodyHash("issue body");
  const h2 = computeBodyHash("issue body");
  const h3 = computeBodyHash("issue body, edited");
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

const cleanG10 = {
  issueAuthorHasWrite: true,
  commenterPermissions: [{ login: "carol", hasWrite: true }],
  currentBodyHash: "abc",
  snapshotBodyHash: "abc",
  acceptanceCriteriaCrowdDerived: false,
};
test("G10 passes when author and commenters have write and the body hash is unchanged", () =>
  assert.equal(guardG10(cleanG10).pass, true));
test("G10 fails when the issue author lacks write permission", () =>
  assert.equal(guardG10({ ...cleanG10, issueAuthorHasWrite: false }).pass, false));
test("G10 fails when a commenter who entered the agent context lacks write permission", () =>
  assert.equal(
    guardG10({
      ...cleanG10,
      commenterPermissions: [{ login: "mallory", hasWrite: false }],
    }).pass,
    false,
  ));
test("G10 fails when the body hash no longer matches the snapshot", () =>
  assert.equal(guardG10({ ...cleanG10, currentBodyHash: "different" }).pass, false));
test("G10 fails on a thin issue whose acceptance criteria were crowd-derived", () =>
  assert.equal(guardG10({ ...cleanG10, acceptanceCriteriaCrowdDerived: true }).pass, false));

// --- G11 -----------------------------------------------------------------
function freshPauseFile() {
  const dir = mkdtempSync(join(tmpdir(), "g11-test-"));
  return { dir, pauseFilePath: join(dir, ".dev-pause") };
}

const futureIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
function cleanG11(pauseFilePath) {
  return {
    routeReadSucceeded: true,
    route: {
      repos: { "my-repo": { type: "backend" } },
      dev_grants: [{ repos: ["my-repo"], expires_on: futureIso, principle_ref: "abc123" }],
    },
    repoName: "my-repo",
    now: new Date(),
    principleRefIsAncestorOfDefaultBranch: true,
    defaultBranchSkillMdText: "...SA-1...",
    pauseFilePath,
  };
}

test("G11 passes with a valid, unexpired grant, SA-1 marker present, and no pause file", () => {
  const { dir, pauseFilePath } = freshPauseFile();
  try {
    assert.equal(guardG11(cleanG11(pauseFilePath)).pass, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("G11 fails closed when the live route read itself failed, regardless of everything else", () => {
  const { dir, pauseFilePath } = freshPauseFile();
  try {
    assert.equal(
      guardG11({ ...cleanG11(pauseFilePath), routeReadSucceeded: false }).pass,
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("G11 fails when the repo has no grant (delegates to resolveRepoAuthorization)", () => {
  const { dir, pauseFilePath } = freshPauseFile();
  try {
    const input = cleanG11(pauseFilePath);
    input.route.dev_grants = [];
    assert.equal(guardG11(input).pass, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("G11 fails when principle_ref is not an ancestor of the default branch", () => {
  const { dir, pauseFilePath } = freshPauseFile();
  try {
    assert.equal(
      guardG11({
        ...cleanG11(pauseFilePath),
        principleRefIsAncestorOfDefaultBranch: false,
      }).pass,
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("G11 fails when the default branch SKILL.md no longer carries the SA-1 marker", () => {
  const { dir, pauseFilePath } = freshPauseFile();
  try {
    assert.equal(
      guardG11({
        ...cleanG11(pauseFilePath),
        defaultBranchSkillMdText: "...the clause was removed...",
      }).pass,
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("G11 fails when a local .dev-pause is set", () => {
  const { dir, pauseFilePath } = freshPauseFile();
  try {
    writePause(pauseFilePath, "circuit breaker tripped");
    assert.equal(guardG11(cleanG11(pauseFilePath)).pass, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

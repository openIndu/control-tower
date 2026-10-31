import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildRealStep4Deps } from "./real-step4-deps.mjs";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "real-step4-deps-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function baseRunContext(docsDir, overrides = {}) {
  return {
    org: "openIndu",
    repo: "backend",
    baseRef: "origin/main",
    defaultBranch: "main",
    docsDir,
    carrier: {
      systemPromptFilePath: "/wt/sp.txt",
      promptDir: "/tmp/prompts",
      allowedToolCommands: ["npm test"],
      maxBudgetUsd: 5,
    },
    controlTowerRepoPath: "/ct",
    controlTowerRef: "main",
    grantPrincipleRef: "principle-sha",
    resumePrNumber: null,
    commit: {
      coAuthoredBy: "Claude Sonnet 5 <noreply@anthropic.com>",
      signoff: false,
    },
    publishesOnMerge: false,
    authorizedApprovers: ["@alice"],
    recordedMergeShas: ["abc123"],
    twoConsecutiveBlockedIssues: false,
    repeatedToolErrors: false,
    ...overrides,
  };
}

function baseIssueArgs(overrides = {}) {
  return {
    worktreePath: "/wt",
    branchName: "dev/issue-9",
    issue: {
      number: 9,
      title: "Fix the thing",
      body: "it is broken",
      source: { issueAuthorHasWrite: true, commenterPermissions: [] },
      bodyHashAtSnapshot: "snap-hash",
    },
    tier: "lite",
    scoping: {
      confidence: 0.9,
      reviewerStatedUncertain: false,
      acceptanceCriteriaCrowdDerived: false,
    },
    declaredPaths: ["src/a.ts"],
    solutionDocument: "## Solution\nDo the fix.",
    implementationReviewDocument: "## Review\nLooks good.",
    ...overrides,
  };
}

function overridesWithCapturedFacts(capture, extraOverrides = {}) {
  return {
    getCommitSha: () => "reviewed-sha",
    computePatchId: () => "reviewed-patch-id",
    fetchCurrentIssueBody: () => "current body text",
    now: () => new Date("2026-10-31T00:00:00Z"),
    step4CallbacksOverrides: {
      gatherFacts: async (context, internalFacts) => {
        capture.push({ ...internalFacts });
        return { ok: true };
      },
      ...extraOverrides,
    },
  };
}

test("buildRealStep4Deps writes a PR body file embedding both documents and the blast radius", () => {
  withTempDir((docsDir) => {
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs(),
      overridesWithCapturedFacts([]),
    );
    assert.ok(callbacks.openPr, "returns the real buildStep4Callbacks object");
    const prBodyPath = join(docsDir, "issue-9-pr-body.md");
    assert.ok(existsSync(prBodyPath));
    const text = readFileSync(prBodyPath, "utf8");
    assert.match(text, /Closes #9/);
    assert.match(text, /Do the fix\./);
    assert.match(text, /Looks good\./);
    assert.ok(!text.includes("Publishes on merge"));
  });
});

test("buildRealStep4Deps includes the publishes-on-merge disclosure when the repo is configured for it", () => {
  withTempDir((docsDir) => {
    buildRealStep4Deps(
      baseRunContext(docsDir, { publishesOnMerge: true }),
      baseIssueArgs(),
      overridesWithCapturedFacts([]),
    );
    const text = readFileSync(join(docsDir, "issue-9-pr-body.md"), "utf8");
    assert.match(text, /Publishes on merge/);
  });
});

test("buildRealStep4Deps sources declaredPlanPaths/riskTier/priorRiskTier/confidence/reviewExpressedUncertainty/acceptanceCriteriaCrowdDerived from tier+scoping+declaredPaths", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs(),
      overridesWithCapturedFacts(captured),
    );
    await callbacks.gatherPromotionFacts(1);
    assert.deepEqual(captured[0].declaredPlanPaths, ["src/a.ts"]);
    assert.equal(captured[0].riskTier, "lite");
    assert.equal(captured[0].priorRiskTier, "lite");
    assert.equal(captured[0].confidence, 0.9);
    assert.equal(captured[0].reviewExpressedUncertainty, false);
    assert.equal(captured[0].acceptanceCriteriaCrowdDerived, false);
  });
});

test("buildRealStep4Deps sources G10's facts from the issue's own snapshot-entry fields", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs({
        issue: {
          number: 9,
          title: "t",
          body: "b",
          source: {
            issueAuthorHasWrite: false,
            commenterPermissions: [{ login: "x", hasWrite: false }],
          },
          bodyHashAtSnapshot: "the-snapshot-hash",
        },
      }),
      overridesWithCapturedFacts(captured),
    );
    await callbacks.gatherPromotionFacts(1);
    assert.equal(captured[0].issueAuthorHasWrite, false);
    assert.deepEqual(captured[0].commenterPermissions, [
      { login: "x", hasWrite: false },
    ]);
    assert.equal(captured[0].snapshotBodyHash, "the-snapshot-hash");
  });
});

test("buildRealStep4Deps's G10 facts fall back safely when issue carries no snapshot fields at all (a plain {number, title, body} fixture)", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs({ issue: { number: 9, title: "t", body: "b" } }),
      overridesWithCapturedFacts(captured),
    );
    await callbacks.gatherPromotionFacts(1);
    assert.equal(captured[0].issueAuthorHasWrite, false);
    assert.deepEqual(captured[0].commenterPermissions, []);
    assert.equal(captured[0].snapshotBodyHash, null);
  });
});

test("buildRealStep4Deps's declaredPlanPaths defaults to [] when declaredPaths is null (resume path)", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs({ declaredPaths: null }),
      overridesWithCapturedFacts(captured),
    );
    await callbacks.gatherPromotionFacts(1);
    assert.deepEqual(captured[0].declaredPlanPaths, []);
  });
});

test("buildRealStep4Deps passes repoName, authorizedApprovers, and the circuit-breaker run-state facts straight through from runContext", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir, {
        authorizedApprovers: ["@bob", "@carol"],
        recordedMergeShas: ["sha1", "sha2"],
        twoConsecutiveBlockedIssues: true,
        repeatedToolErrors: true,
      }),
      baseIssueArgs(),
      overridesWithCapturedFacts(captured),
    );
    await callbacks.gatherPromotionFacts(1);
    assert.deepEqual(captured[0].authorizedApprovers, ["@bob", "@carol"]);
    assert.equal(captured[0].repoName, "backend");
    assert.deepEqual(captured[0].recordedMergeShas, ["sha1", "sha2"]);
    assert.equal(captured[0].twoConsecutiveBlockedIssues, true);
    assert.equal(captured[0].repeatedToolErrors, true);
  });
});

test("buildRealStep4Deps's reviewedSha/reviewedPatchId are memoized: getCommitSha/computePatchId are called at most once across two gatherFactsFor calls", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    let commitShaCalls = 0;
    let patchIdCalls = 0;
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs(),
      {
        getCommitSha: () => {
          commitShaCalls++;
          return "reviewed-sha";
        },
        computePatchId: () => {
          patchIdCalls++;
          return "reviewed-patch-id";
        },
        fetchCurrentIssueBody: () => "body",
        now: () => new Date(),
        step4CallbacksOverrides: {
          gatherFacts: async (context, internalFacts) => {
            captured.push({ ...internalFacts });
            return { ok: true };
          },
        },
      },
    );
    await callbacks.gatherPromotionFacts(1);
    await callbacks.gatherPostPromotionFacts(1);
    assert.equal(commitShaCalls, 1);
    assert.equal(patchIdCalls, 1);
    assert.equal(captured[0].reviewedSha, "reviewed-sha");
    assert.equal(captured[1].reviewedSha, "reviewed-sha");
    assert.equal(captured[0].reviewedPatchId, "reviewed-patch-id");
  });
});

test("buildRealStep4Deps's currentBodyHash is NOT memoized: it re-fetches the issue body fresh on every gatherFactsFor call", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    let fetchCalls = 0;
    const bodies = ["first read", "second read -- edited since"];
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs(),
      {
        getCommitSha: () => "sha",
        computePatchId: () => "patch-id",
        fetchCurrentIssueBody: () => bodies[fetchCalls++],
        now: () => new Date(),
        step4CallbacksOverrides: {
          gatherFacts: async (context, internalFacts) => {
            captured.push({ ...internalFacts });
            return { ok: true };
          },
        },
      },
    );
    await callbacks.gatherPromotionFacts(1);
    await callbacks.gatherPostPromotionFacts(1);
    assert.equal(fetchCalls, 2);
    assert.notEqual(captured[0].currentBodyHash, captured[1].currentBodyHash);
  });
});

test("buildRealStep4Deps hardcodes ciRanOnCurrentHead:true and unresolvedMustFixCount:0, by construction of when step 4 is reached", async () => {
  await withTempDir(async (docsDir) => {
    const captured = [];
    const callbacks = buildRealStep4Deps(
      baseRunContext(docsDir),
      baseIssueArgs(),
      overridesWithCapturedFacts(captured),
    );
    await callbacks.gatherPromotionFacts(1);
    assert.equal(captured[0].ciRanOnCurrentHead, true);
    assert.equal(captured[0].unresolvedMustFixCount, 0);
  });
});

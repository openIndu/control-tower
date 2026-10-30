import assert from "node:assert/strict";
import test from "node:test";

import { countTopLevelDirectories, gatherMergeFacts } from "./merge-facts.mjs";

test("countTopLevelDirectories counts distinct top-level path segments", () => {
  assert.equal(
    countTopLevelDirectories(["src/a.js", "src/b.js", "docs/c.md"]),
    2,
  );
  assert.equal(countTopLevelDirectories(["a.js"]), 1);
  assert.equal(countTopLevelDirectories([]), 0);
});

function fakeDeps(overrides = {}) {
  return {
    fetchPrSnapshot: () => ({
      prHeadSha: "head-sha",
      isReady: true,
      hasConflicts: false,
      isMergeable: true,
      actualChecks: [
        { name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
      ],
      changedFiles: [
        { path: "src/a.js", status: "modified", additions: 3, deletions: 1 },
        { path: "docs/b.md", status: "modified", additions: 2, deletions: 0 },
      ],
      totalLinesChanged: 6,
    }),
    fetchDefaultBranchHeadSha: () => "default-head-sha",
    fetchDefaultBranchHeadConclusion: () => "SUCCESS",
    checkAncestry: () => true,
    computeUnifiedDiff: () => "diff-text",
    computePatchId: () => "patch-id-abc",
    fetchCodeownersText: () => "* @org/team\n",
    fetchRoute: () => '{"version":"1.0","repos":{}}',
    fetchPrincipleSkillMd: () => "## SA-1\nsome principle text",
    ...overrides,
  };
}

test("gatherMergeFacts composes the PR snapshot, ancestry, diff, patch-id, codeowners, and the module-boundary heuristic", async () => {
  const facts = await gatherMergeFacts(
    {
      org: "openIndu",
      repo: "backend",
      prNumber: 7,
      repoWorktreePath: "/wt",
      baseRef: "main",
      defaultBranch: "main",
    },
    {},
    fakeDeps(),
  );
  assert.equal(facts.prHeadSha, "head-sha");
  assert.equal(facts.isMergeable, true);
  assert.equal(facts.defaultBranchHeadSha, "default-head-sha");
  assert.equal(facts.defaultBranchHeadConclusion, "SUCCESS");
  assert.equal(facts.prIncludesDefaultBranchHead, true);
  assert.equal(facts.unifiedDiff, "diff-text");
  assert.equal(facts.currentPatchId, "patch-id-abc");
  assert.equal(facts.codeownersText, "* @org/team\n");
  assert.deepEqual(facts.changedPaths, ["src/a.js", "docs/b.md"]);
  assert.equal(facts.moduleBoundariesTouched, 2);
  assert.deepEqual(facts.baseCoverageThresholds, {});
  assert.deepEqual(facts.headCoverageThresholds, {});
});

test("gatherMergeFacts passes the PR's own head SHA as the ancestry check's descendant and the default branch head SHA as the ancestor", async () => {
  let seenArgs = null;
  await gatherMergeFacts(
    {
      org: "openIndu",
      repo: "backend",
      prNumber: 7,
      repoWorktreePath: "/wt",
      baseRef: "main",
      defaultBranch: "main",
    },
    {},
    fakeDeps({
      checkAncestry: (repoPath, ancestorSha, descendantRef) => {
        seenArgs = { repoPath, ancestorSha, descendantRef };
        return true;
      },
    }),
  );
  assert.equal(seenArgs.repoPath, "/wt");
  assert.equal(seenArgs.ancestorSha, "default-head-sha");
  assert.equal(seenArgs.descendantRef, "head-sha");
});

test("gatherMergeFacts lets internalFacts override/extend the gathered facts (e.g. reviewedSha, unresolvedMustFixCount)", async () => {
  const facts = await gatherMergeFacts(
    {
      org: "openIndu",
      repo: "backend",
      prNumber: 7,
      repoWorktreePath: "/wt",
      baseRef: "main",
      defaultBranch: "main",
    },
    {
      reviewedSha: "head-sha",
      ciEvaluatedSha: "head-sha",
      unresolvedMustFixCount: 0,
      riskTier: "L1",
    },
    fakeDeps(),
  );
  assert.equal(facts.reviewedSha, "head-sha");
  assert.equal(facts.ciEvaluatedSha, "head-sha");
  assert.equal(facts.unresolvedMustFixCount, 0);
  assert.equal(facts.riskTier, "L1");
  assert.equal(facts.prHeadSha, "head-sha");
});

test("gatherMergeFacts (G11) reads route.json and the principle SKILL.md live, and checks the grant's principle_ref against the control-tower ref", async () => {
  let ancestrySeen = [];
  const facts = await gatherMergeFacts(
    {
      org: "openIndu",
      repo: "backend",
      prNumber: 7,
      repoWorktreePath: "/wt",
      baseRef: "main",
      defaultBranch: "main",
      controlTowerRepoPath: "/ct",
      controlTowerRef: "main",
      grantPrincipleRef: "principle-sha",
    },
    {},
    fakeDeps({
      checkAncestry: (repoPath, ancestorSha, descendantRef) => {
        ancestrySeen.push({ repoPath, ancestorSha, descendantRef });
        return true;
      },
    }),
  );
  assert.equal(facts.routeReadSucceeded, true);
  assert.deepEqual(facts.route, { version: "1.0", repos: {} });
  assert.match(facts.defaultBranchSkillMdText, /SA-1/);
  assert.equal(facts.principleRefIsAncestorOfDefaultBranch, true);
  assert.deepEqual(ancestrySeen[1], {
    repoPath: "/ct",
    ancestorSha: "principle-sha",
    descendantRef: "main",
  });
});

test("gatherMergeFacts (G11) fails closed -- routeReadSucceeded is false when the live route read throws", async () => {
  const facts = await gatherMergeFacts(
    {
      org: "openIndu",
      repo: "backend",
      prNumber: 7,
      repoWorktreePath: "/wt",
      baseRef: "main",
      defaultBranch: "main",
      controlTowerRef: "main",
    },
    {},
    fakeDeps({
      fetchRoute: () => {
        throw new Error("network error");
      },
    }),
  );
  assert.equal(facts.routeReadSucceeded, false);
});

test("gatherMergeFacts (G11) treats a missing grantPrincipleRef as not-an-ancestor rather than throwing", async () => {
  const facts = await gatherMergeFacts(
    {
      org: "openIndu",
      repo: "backend",
      prNumber: 7,
      repoWorktreePath: "/wt",
      baseRef: "main",
      defaultBranch: "main",
      controlTowerRef: "main",
    },
    {},
    fakeDeps(),
  );
  assert.equal(facts.principleRefIsAncestorOfDefaultBranch, false);
});

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EXIT_CODES } from "../../../engine/exit-codes.mjs";
import {
  createRunState,
  markMerged,
  markPrOpened,
  RunLockHeldError,
} from "../../../engine/run-state.mjs";
import { gatherAdmissionFacts, parseArgs, runIntake, runRepo } from "./dev.mjs";

test("parseArgs requires --repo", () => {
  assert.throws(() => parseArgs([]), /--repo requires a value/);
});

test("parseArgs defaults org to openIndu and parses flags", () => {
  const options = parseArgs([
    "--repo",
    "openIndu-backend",
    "--dry-run",
    "--no-merge",
  ]);
  assert.equal(options.org, "openIndu");
  assert.equal(options.repo, "openIndu-backend");
  assert.equal(options.dryRun, true);
  assert.equal(options.noMerge, true);
  assert.equal(options.resume, null);
});

test("parseArgs parses --resume with its run-id value", () => {
  const options = parseArgs(["--repo", "x", "--resume", "run-abc-123"]);
  assert.equal(options.resume, "run-abc-123");
});

test("parseArgs rejects an unknown flag", () => {
  assert.throws(
    () => parseArgs(["--repo", "x", "--bogus"]),
    /Unknown argument/,
  );
});

test("parseArgs --help does not require --repo", () => {
  const options = parseArgs(["--help"]);
  assert.equal(options.help, true);
});

test("gatherAdmissionFacts upper-cases a lowercase commit-status state and reads the default branch once", () => {
  let branchCallCount = 0;
  const facts = gatherAdmissionFacts(
    { org: "openIndu", repo: "backend" },
    {
      defaultBranch: () => {
        branchCallCount += 1;
        return "main";
      },
      hasCiWorkflow: () => true,
      headCiState: (org, repo, branch) => {
        assert.equal(branch, "main");
        return "SUCCESS";
      },
    },
  );
  assert.equal(facts.defaultBranch, "main");
  assert.equal(facts.hasDefaultBranchCiWorkflow, true);
  assert.equal(facts.defaultBranchHeadCiState, "SUCCESS");
  assert.equal(branchCallCount, 1);
});

const ROUTE_JSON = JSON.stringify({
  repos: {
    "openIndu-backend": {
      type: "backend",
      dev: {
        enabled: true,
        required_checks: [{ kind: "test" }, { kind: "secret-scan" }],
      },
    },
    "openIndu-not-enabled": {
      type: "backend",
      dev: { required_checks: [{ kind: "test" }, { kind: "secret-scan" }] },
    },
    "control-tower": { type: "control-tower" },
  },
  dev_grants: [],
});

function baseDeps(overrides = {}) {
  return {
    fetchRoute: () => ROUTE_JSON,
    collectIssues: () => ({ issueCount: 0, issues: [] }),
    gatherAdmission: () => ({
      hasDefaultBranchCiWorkflow: true,
      defaultBranchHeadCiState: "SUCCESS",
    }),
    sourcePermissions: () => ({
      issueAuthorHasWrite: true,
      commenterPermissions: [],
    }),
    ...overrides,
  };
}

test("runIntake reports ARGUMENT_ERROR (exit 1) for a repo not in route.json", async () => {
  const result = await runIntake(
    { org: "openIndu", repo: "does-not-exist" },
    baseDeps(),
  );
  assert.equal(result.outcome, "ARGUMENT_ERROR");
  assert.equal(result.exitCode, 1);
});

test("runIntake reports REJECTED (exit 3) for a structurally-excluded repo, never calling collectIssues", async () => {
  let called = false;
  const result = await runIntake(
    { org: "openIndu", repo: "control-tower" },
    baseDeps({
      collectIssues: () => {
        called = true;
        return { issueCount: 0, issues: [] };
      },
    }),
  );
  assert.equal(result.outcome, "REJECTED");
  assert.equal(result.exitCode, 3);
  assert.equal(called, false);
});

test("runIntake reports REJECTED (exit 3) when dev.enabled is not true, never gathering admission facts or calling collectIssues", async () => {
  let admissionCalled = false;
  let collectCalled = false;
  const result = await runIntake(
    { org: "openIndu", repo: "openIndu-not-enabled" },
    baseDeps({
      gatherAdmission: () => {
        admissionCalled = true;
        return {
          hasDefaultBranchCiWorkflow: true,
          defaultBranchHeadCiState: "SUCCESS",
        };
      },
      collectIssues: () => {
        collectCalled = true;
        return { issueCount: 0, issues: [] };
      },
    }),
  );
  assert.equal(result.outcome, "REJECTED");
  assert.equal(result.exitCode, 3);
  assert.match(result.reason, /dev\.enabled/);
  assert.equal(admissionCalled, false);
  assert.equal(collectCalled, false);
});

test("runIntake reports REJECTED (exit 3) when admission A1 fails (no CI workflow at all), never calling collectIssues", async () => {
  let called = false;
  const result = await runIntake(
    { org: "openIndu", repo: "openIndu-backend" },
    baseDeps({
      gatherAdmission: () => ({
        hasDefaultBranchCiWorkflow: false,
        defaultBranchHeadCiState: "SUCCESS",
      }),
      collectIssues: () => {
        called = true;
        return { issueCount: 0, issues: [] };
      },
    }),
  );
  assert.equal(result.outcome, "REJECTED");
  assert.equal(result.exitCode, 3);
  assert.equal(called, false);
});

test("runIntake reports NO_ACTION (exit 0) with the zero-issues report when there are no open issues", async () => {
  const result = await runIntake(
    { org: "openIndu", repo: "openIndu-backend" },
    baseDeps(),
  );
  assert.equal(result.outcome, "NO_ACTION");
  assert.equal(result.exitCode, 0);
  assert.match(result.report, /0 项/);
});

test("runIntake still collects issues and completes intake when admission is PR_ONLY (A3 fails)", async () => {
  const result = await runIntake(
    { org: "openIndu", repo: "openIndu-backend" },
    baseDeps({
      gatherAdmission: () => ({
        hasDefaultBranchCiWorkflow: true,
        defaultBranchHeadCiState: "FAILURE",
      }),
      collectIssues: () => ({
        issueCount: 1,
        issues: [
          {
            id: "openIndu-backend#1",
            number: 1,
            author: "alice",
            title: "x",
            body: "y",
          },
        ],
      }),
    }),
  );
  assert.equal(result.outcome, "INTAKE_COMPLETE");
  assert.equal(result.admissionResult, "pr_only");
  assert.equal(result.snapshot.issueCount, 1);
});

test("runIntake builds a snapshot entry per issue using the author login for the source-permission check", async () => {
  const seenAuthors = [];
  const result = await runIntake(
    { org: "openIndu", repo: "openIndu-backend" },
    baseDeps({
      collectIssues: () => ({
        issueCount: 2,
        issues: [
          {
            id: "openIndu-backend#1",
            number: 1,
            author: "alice",
            title: "a",
            body: "",
          },
          {
            id: "openIndu-backend#2",
            number: 2,
            author: "bob",
            title: "b",
            body: "",
          },
        ],
      }),
      sourcePermissions: ({ authorLogin }) => {
        seenAuthors.push(authorLogin);
        return {
          issueAuthorHasWrite: authorLogin === "alice",
          commenterPermissions: [],
        };
      },
    }),
  );
  assert.equal(result.outcome, "INTAKE_COMPLETE");
  assert.deepEqual(seenAuthors, ["alice", "bob"]);
  assert.equal(result.snapshot.issues[0].source.issueAuthorHasWrite, true);
  assert.equal(result.snapshot.issues[1].source.issueAuthorHasWrite, false);
});

function fakeIntakeComplete({ issueCount = 1, dev = {}, devGrants = [] } = {}) {
  const issues = Array.from({ length: issueCount }, (_, index) => ({
    number: index + 1,
    title: `issue ${index + 1}`,
    body: "body",
    author: "alice",
    bodyHashAtSnapshot: "hash",
    source: { issueAuthorHasWrite: false, commenterPermissions: [] },
  }));
  return {
    outcome: "INTAKE_COMPLETE",
    admissionResult: "auto_merge_eligible",
    route: {
      repos: { "openIndu-backend": { type: "backend", dev } },
      dev_grants: devGrants,
    },
    repoEntry: { type: "backend", dev },
    defaultBranch: "main",
    snapshot: { issueCount, issues, takenAt: "2026-10-31T00:00:00.000Z" },
    issues,
  };
}

function baseRunRepoOverrides(overrides = {}) {
  return {
    ensureClone: () => ({ cloned: false }),
    worktreeBaseDir: "/base",
    setupPrompt: () => "/base/run-1/system-prompt.txt",
    generateRunId: () => "run-1",
    resolveDocsDirFn: (repo, runId) => `/docs/${repo}/${runId}`,
    resolveRepoDocsDirFn: (repo) => `/docs/${repo}`,
    resolveApprovers: () => ["@alice"],
    buildStep4DepsFn: () => ({ stepFourDepsBuilt: true }),
    acquireLock: () => {},
    releaseLock: () => {},
    loadState: () => {
      throw new Error("loadState should not be called for a fresh run");
    },
    saveState: () => {},
    ...overrides,
  };
}

test("runRepo passes through runIntake's non-INTAKE_COMPLETE result unchanged, without touching the filesystem or GitHub", async () => {
  const rejected = {
    outcome: "REJECTED",
    exitCode: EXIT_CODES.REJECTED,
    reason: "dev.enabled is not true for this repo",
  };
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({ runIntakeFn: async () => rejected }),
  );
  assert.deepEqual(result, rejected);
});

test("runRepo refuses --dry-run explicitly rather than silently running the real pipeline", async () => {
  let pipelineCalled = false;
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend", dryRun: true },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete(),
      runPipeline: async () => {
        pipelineCalled = true;
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(result.outcome, "NOT_YET_IMPLEMENTED");
  assert.equal(pipelineCalled, false);
});

test("runRepo clones once, sets up the system prompt once, and calls the real pipeline once per issue up to --max-issues", async () => {
  const pipelineCalls = [];
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend", maxIssues: 2 },
    baseRunRepoOverrides({
      runIntakeFn: async () =>
        fakeIntakeComplete({ issueCount: 3, dev: { checks: ["npm test"] } }),
      runPipeline: async (issue, pipelineOptions, deps) => {
        pipelineCalls.push({ issue, pipelineOptions, deps });
        return { state: "NO_ACTION" };
      },
    }),
  );

  assert.equal(pipelineCalls.length, 2);
  assert.equal(pipelineCalls[0].issue.number, 1);
  assert.equal(pipelineCalls[1].issue.number, 2);
  assert.deepEqual(pipelineCalls[0].pipelineOptions.devChecks, ["npm test"]);
  assert.equal(
    pipelineCalls[0].pipelineOptions.pauseFilePath,
    join("/docs/openIndu-backend", ".dev-pause"),
  );
  assert.equal(typeof pipelineCalls[0].deps.buildStep4Deps, "function");
  assert.equal(typeof pipelineCalls[0].deps.generateProposal, "function");
  assert.notEqual(pipelineCalls[0].pipelineOptions.worktreeBaseDir, undefined);
  assert.equal(result.outcome, "RUN_COMPLETE");
  assert.equal(result.exitCode, EXIT_CODES.OK);
});

test("runRepo gives each issue its own promptDir (sibling of its worktree, not shared across issues)", async () => {
  const promptDirs = [];
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 2 }),
      buildStep4DepsFn: (runContext) => {
        promptDirs.push(runContext.carrier.promptDir);
        return { stepFourDepsBuilt: true };
      },
      runPipeline: async (issue, pipelineOptions, deps) => {
        deps.buildStep4Deps({ issue });
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(promptDirs.length, 2);
  assert.notEqual(promptDirs[0], promptDirs[1]);
  assert.match(promptDirs[0], /issue-1-prompts$/);
  assert.match(promptDirs[1], /issue-2-prompts$/);
});

test("runRepo sets stopAfterCiGreen=true when --no-merge is passed, even with a valid grant", async () => {
  let seenStop;
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend", noMerge: true },
    baseRunRepoOverrides({
      runIntakeFn: async () =>
        fakeIntakeComplete({
          devGrants: [
            { repos: ["openIndu-backend"], expires_on: "2999-01-01" },
          ],
        }),
      runPipeline: async (issue, pipelineOptions) => {
        seenStop = pipelineOptions.stopAfterCiGreen;
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(seenStop, true);
});

test("runRepo sets stopAfterCiGreen=true when the repo has no live grant, even without --no-merge", async () => {
  let seenStop;
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ devGrants: [] }),
      runPipeline: async (issue, pipelineOptions) => {
        seenStop = pipelineOptions.stopAfterCiGreen;
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(seenStop, true);
});

test("runRepo sets stopAfterCiGreen=false when the repo has a live grant and --no-merge is not passed", async () => {
  let seenStop;
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () =>
        fakeIntakeComplete({
          devGrants: [
            { repos: ["openIndu-backend"], expires_on: "2999-01-01" },
          ],
        }),
      runPipeline: async (issue, pipelineOptions) => {
        seenStop = pipelineOptions.stopAfterCiGreen;
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(seenStop, false);
});

test("runRepo's exit code reflects the batch of issue outcomes via exitCodeForStates (PARTIAL when any issue is BLOCKED)", async () => {
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 2 }),
      runPipeline: async (issue) => ({
        state: issue.number === 1 ? "MERGED" : "BLOCKED",
      }),
    }),
  );
  assert.equal(result.exitCode, EXIT_CODES.PARTIAL);
  assert.equal(result.results.length, 2);
});

test("runRepo's buildStep4Deps closure forwards the per-issue issueArgs to the injected buildStep4DepsFn, along with the resolved runContext (carrier + authorizedApprovers)", async () => {
  let capturedRunContext;
  let capturedIssueArgs;
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      resolveApprovers: () => ["@alice", "@bob"],
      buildStep4DepsFn: (runContext, issueArgs) => {
        capturedRunContext = runContext;
        capturedIssueArgs = issueArgs;
        return { stepFourDepsBuilt: true };
      },
      runPipeline: async (issue, pipelineOptions, deps) => {
        const step4Deps = deps.buildStep4Deps({
          worktreePath: "/wt/issue-1",
          branchName: "dev/issue-1",
          issue,
          tier: "T1",
          scoping: {},
          declaredPaths: [],
          solutionDocument: null,
          implementationReviewDocument: null,
        });
        assert.deepEqual(step4Deps, { stepFourDepsBuilt: true });
        return { state: "NO_ACTION" };
      },
    }),
  );

  assert.deepEqual(capturedRunContext.authorizedApprovers, ["@alice", "@bob"]);
  assert.equal(capturedRunContext.resumePrNumber, null);
  assert.equal(typeof capturedRunContext.carrier.promptDir, "string");
  assert.equal(capturedIssueArgs.issue.number, 1);
  assert.equal(capturedIssueArgs.tier, "T1");
});

test("runRepo returns RUN_LOCKED and never touches the pipeline when another run already holds the lock", async () => {
  let pipelineCalled = false;
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete(),
      acquireLock: () => {
        throw new RunLockHeldError("run-other");
      },
      runPipeline: async () => {
        pipelineCalled = true;
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(result.outcome, "RUN_LOCKED");
  assert.match(result.reason, /run-other/);
  assert.equal(pipelineCalled, false);
});

test("runRepo releases the lock even when the pipeline throws", async () => {
  let released = false;
  await assert.rejects(
    runRepo(
      { org: "openIndu", repo: "openIndu-backend" },
      baseRunRepoOverrides({
        runIntakeFn: async () => fakeIntakeComplete(),
        releaseLock: () => {
          released = true;
        },
        runPipeline: async () => {
          throw new Error("boom");
        },
      }),
    ),
    /boom/,
  );
  assert.equal(released, true);
});

test("runRepo starts a fresh run with an empty run-state (never calls loadState) when --resume is not passed", async () => {
  let savedStates = [];
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      saveState: (path, state) => savedStates.push({ path, state }),
      runPipeline: async () => ({ state: "NO_ACTION" }),
    }),
  );
  // baseRunRepoOverrides' loadState throws if called -- reaching this
  // assertion at all already proves it was not called for a fresh run.
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].state.runId, "run-1");
  assert.deepEqual(savedStates[0].state.issues, {});
});

test("runRepo loads existing run-state via --resume, and feeds that issue's prior prNumber into both resumeIssueState and the runContext override", async () => {
  const priorState = markPrOpened(
    createRunState({ runId: "run-1", repoName: "openIndu-backend" }),
    1,
    42,
  );
  let seenResumeIssueState;
  let seenRunContext;
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend", resume: "run-1" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      loadState: () => priorState,
      buildStep4DepsFn: (runContext) => {
        seenRunContext = runContext;
        return { stepFourDepsBuilt: true };
      },
      runPipeline: async (issue, pipelineOptions, deps) => {
        seenResumeIssueState = pipelineOptions.resumeIssueState;
        deps.buildStep4Deps({ issue });
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(seenResumeIssueState.openedPr, true);
  assert.equal(seenResumeIssueState.prNumber, 42);
  assert.equal(seenRunContext.resumePrNumber, 42);
});

test("runRepo persists markPrOpened then markMerged into the saved run-state as an issue opens a PR and merges", async () => {
  let lastSaved;
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      saveState: (path, state) => {
        lastSaved = state;
      },
      runPipeline: async () => ({
        state: "MERGED",
        prNumber: 7,
        mergeCommit: "abc123",
      }),
    }),
  );
  const expected = markMerged(
    markPrOpened(
      createRunState({
        runId: "run-1",
        repoName: "openIndu-backend",
        startedAt: lastSaved.startedAt,
      }),
      1,
      7,
    ),
    1,
    { mergeSha: "abc123", mergedAt: lastSaved.issues[1].mergedAt },
  );
  assert.deepEqual(lastSaved, expected);
});

test("runRepo does not re-mark an issue's PR as freshly opened on resume when resumeIssueState already has openedPr", async () => {
  const priorState = markPrOpened(
    createRunState({ runId: "run-1", repoName: "openIndu-backend" }),
    1,
    42,
  );
  let lastSaved;
  await runRepo(
    { org: "openIndu", repo: "openIndu-backend", resume: "run-1" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      loadState: () => priorState,
      saveState: (path, state) => {
        lastSaved = state;
      },
      runPipeline: async () => ({ state: "PR_GREEN", prNumber: 42 }),
    }),
  );
  // Still marked opened (unchanged), and no spurious re-write of openedPr's
  // bookkeeping -- the saved state after this call equals the prior state
  // exactly (PR_GREEN doesn't trigger markMerged).
  assert.deepEqual(lastSaved, priorState);
});

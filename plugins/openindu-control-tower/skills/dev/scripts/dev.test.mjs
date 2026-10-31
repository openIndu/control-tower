import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EXIT_CODES } from "../../../engine/exit-codes.mjs";
import { PointsAtProductionError } from "../../../engine/local-service.mjs";
import {
  createRunState,
  markMerged,
  markPrOpened,
  RunLockHeldError,
} from "../../../engine/run-state.mjs";
import {
  gatherAdmissionFacts,
  parseArgs,
  runAckCommand,
  runBuildCommand,
  runIntake,
  runRepo,
} from "./dev.mjs";

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

test("parseArgs defaults maxTotalBudgetUsd to null and parses --max-total-budget-usd as a number", () => {
  assert.equal(parseArgs(["--repo", "x"]).maxTotalBudgetUsd, null);
  const options = parseArgs(["--repo", "x", "--max-total-budget-usd", "12.5"]);
  assert.equal(options.maxTotalBudgetUsd, 12.5);
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
    appendTrace: () => {},
    fetchCommitMessages: () => [],
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

test("runRepo rejects --dry-run combined with --resume -- a dry run never writes state.json, so there is nothing to resume", async () => {
  let pipelineCalled = false;
  const result = await runRepo(
    {
      org: "openIndu",
      repo: "openIndu-backend",
      dryRun: true,
      resume: "run-1",
    },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete(),
      runPipeline: async () => {
        pipelineCalled = true;
        return { state: "NO_ACTION" };
      },
    }),
  );
  assert.equal(result.outcome, "ARGUMENT_ERROR");
  assert.equal(result.exitCode, EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR);
  assert.equal(pipelineCalled, false);
});

test("runRepo --dry-run passes stopAfterStep2 to the pipeline for every issue, never touches run-state, and reports DRY_RUN_COMPLETE with exitCode OK", async () => {
  const pipelineOptionsSeen = [];
  let saveStateCalled = false;
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend", dryRun: true },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 2 }),
      saveState: () => {
        saveStateCalled = true;
      },
      runPipeline: async (issue, pipelineOptions) => {
        pipelineOptionsSeen.push(pipelineOptions);
        return {
          dryRun: true,
          tier: "lite",
          solutionDocument: `solution for issue ${issue.number}`,
        };
      },
    }),
  );

  assert.equal(pipelineOptionsSeen.length, 2);
  assert.equal(pipelineOptionsSeen[0].stopAfterStep2, true);
  assert.deepEqual(pipelineOptionsSeen[0].resumeIssueState, {});
  assert.equal(saveStateCalled, false);
  assert.equal(result.outcome, "DRY_RUN_COMPLETE");
  assert.equal(result.exitCode, EXIT_CODES.OK);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].dryRun, true);
  assert.equal(result.results[1].solutionDocument, "solution for issue 2");
});

test("runRepo --dry-run reports exitCode PARTIAL when any issue's tier resolution needed a human before step 2 ran", async () => {
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend", dryRun: true },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 2 }),
      runPipeline: async (issue) =>
        issue.number === 1
          ? { state: "HUMAN_REQUIRED", reason: "ambiguous" }
          : { dryRun: true, tier: "lite", solutionDocument: "x" },
    }),
  );

  assert.equal(result.outcome, "DRY_RUN_COMPLETE");
  assert.equal(result.exitCode, EXIT_CODES.PARTIAL);
});

test("runRepo creates one budget tracker for the whole run from options.maxTotalBudgetUsd, and stops starting new issues once it reports exceeded", async () => {
  const createBudgetCalls = [];
  let completedIssues = 0;
  const pipelineCalls = [];
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend", maxTotalBudgetUsd: 10 },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 3 }),
      createBudget: (maxTotalUsd) => {
        createBudgetCalls.push(maxTotalUsd);
        return {
          addCost: () => {},
          get spentUsd() {
            return completedIssues * 7;
          },
          get exceeded() {
            return completedIssues >= 1;
          },
        };
      },
      runPipeline: async (issue) => {
        pipelineCalls.push(issue.number);
        completedIssues += 1;
        return { state: "NO_ACTION" };
      },
    }),
  );

  assert.deepEqual(createBudgetCalls, [10]);
  assert.deepEqual(pipelineCalls, [1]);
  assert.equal(result.budgetExceeded, true);
  assert.equal(result.spentUsd, 7);
});

test("runRepo reports budgetExceeded: false and the tracker's spentUsd when the budget never trips", async () => {
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 2 }),
      runPipeline: async () => ({ state: "NO_ACTION" }),
    }),
  );

  assert.equal(result.budgetExceeded, false);
  assert.equal(result.spentUsd, 0);
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

test("runRepo's RUN_COMPLETE result includes a rendered report covering every issue", async () => {
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 2 }),
      runPipeline: async (issue) => ({
        state: issue.number === 1 ? "MERGED" : "NO_ACTION",
        prNumber: issue.number === 1 ? 10 : undefined,
        mergeCommit: issue.number === 1 ? "sha1" : undefined,
      }),
    }),
  );

  assert.equal(typeof result.report, "string");
  assert.match(result.report, /\| #1 \|.*\| MERGED \|/);
  assert.match(result.report, /\| #2 \|.*\| NO_ACTION \|/);
  assert.match(result.report, /## Rates/);
});

test("runRepo only fetches the default branch's commit log (for the rollback check) when at least one issue actually merged", async () => {
  const fetchCalls = [];
  const resultWithNoMerge = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      runPipeline: async () => ({ state: "NO_ACTION" }),
      fetchCommitMessages: (...args) => {
        fetchCalls.push(args);
        return [];
      },
    }),
  );
  assert.equal(fetchCalls.length, 0);
  assert.equal(resultWithNoMerge.report.includes("Rollback rate: 0.0%"), true);

  await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      runPipeline: async () => ({
        state: "MERGED",
        prNumber: 10,
        mergeCommit: "sha1",
      }),
      fetchCommitMessages: (...args) => {
        fetchCalls.push(args);
        return [];
      },
    }),
  );
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(fetchCalls[0], [
    join("/base", "clones", "openIndu", "openIndu-backend"),
    "main",
  ]);
});

test("runRepo runs step 5 (local verification) when dev.local_service is configured and an issue merged, writing a checklist and reporting health", async () => {
  const calls = [];
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () =>
        fakeIntakeComplete({
          issueCount: 1,
          dev: {
            local_service: {
              build_command: "npm run build",
              start_command: "npm start",
              health_check_url: "http://localhost:8080/health",
            },
          },
        }),
      runPipeline: async () => ({
        state: "MERGED",
        prNumber: 10,
        mergeCommit: "sha1",
      }),
      createVerifyWorktree: (args) =>
        calls.push(["createVerifyWorktree", args]),
      startService: (args) => {
        calls.push(["startService", args]);
        return { pid: 4321 };
      },
      probeServiceHealth: async (args) => {
        calls.push(["probeServiceHealth", args]);
        return { healthy: true };
      },
      buildSummarizeAcceptanceCriteria: () => async () => ["check the thing"],
      generateChecklist: async (issues) => {
        calls.push(["generateChecklist", issues]);
        return "# Checklist";
      },
      writeChecklist: (path, markdown) => {
        calls.push(["writeChecklist", path, markdown]);
      },
    }),
  );

  assert.deepEqual(result.localServiceResult, {
    attempted: true,
    healthy: true,
    pid: 4321,
    checklistPath: result.localServiceResult.checklistPath,
  });
  assert.equal(typeof result.localServiceResult.checklistPath, "string");
  assert.match(result.report, /## Local verification/);
  assert.match(result.report, /- Healthy: yes/);

  const kinds = calls.map((c) => c[0]);
  assert.deepEqual(kinds, [
    "createVerifyWorktree",
    "startService",
    "probeServiceHealth",
    "generateChecklist",
    "writeChecklist",
  ]);
  assert.deepEqual(
    calls.find((c) => c[0] === "generateChecklist")[1].map((i) => i.number),
    [1],
  );
});

test("runRepo's step 5 starts and health-checks the service even when nothing merged, but skips the checklist (no merged issues to summarize)", async () => {
  let generateChecklistCalled = false;
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () =>
        fakeIntakeComplete({
          issueCount: 1,
          dev: { local_service: { start_command: "npm start" } },
        }),
      runPipeline: async () => ({ state: "NO_ACTION" }),
      createVerifyWorktree: () => {},
      startService: () => ({ pid: 1 }),
      probeServiceHealth: async () => ({ healthy: true }),
      generateChecklist: async () => {
        generateChecklistCalled = true;
        return "# Checklist";
      },
    }),
  );

  assert.equal(generateChecklistCalled, false);
  assert.equal(result.localServiceResult.checklistPath, null);
  assert.match(
    result.report,
    /- Verify checklist: none \(no issue in this run reached MERGED\)/,
  );
});

test("runRepo's step 5 catches a production-check refusal and reports it instead of crashing the run", async () => {
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () =>
        fakeIntakeComplete({
          issueCount: 1,
          dev: {
            local_service: {
              start_command: "npm start",
              forbidden_env_patterns: ["prod-db.internal"],
            },
          },
        }),
      runPipeline: async () => ({
        state: "MERGED",
        prNumber: 10,
        mergeCommit: "sha1",
      }),
      createVerifyWorktree: () => {},
      readLocalServiceEnvText: () => "DATABASE_URL=prod-db.internal",
      startService: () => {
        throw new PointsAtProductionError(["prod-db.internal"]);
      },
    }),
  );

  assert.equal(result.outcome, "RUN_COMPLETE");
  assert.equal(result.results[0].state, "MERGED");
  assert.equal(result.localServiceResult.blockedByProductionCheck, true);
  assert.match(result.report, /- Refused to start: refusing to start/);
});

test("runRepo reports step 5 as not attempted, and step 6 as N/A, when neither dev.local_service nor dev.build is configured", async () => {
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () => fakeIntakeComplete({ issueCount: 1 }),
      runPipeline: async () => ({ state: "NO_ACTION" }),
    }),
  );

  assert.deepEqual(result.localServiceResult, {
    attempted: false,
    reason: "dev.local_service is not configured for this repo",
  });
  assert.equal(result.buildReadiness.status, "N/A");
  assert.match(result.report, /dev\.build readiness: N\/A/);
});

test("runRepo's step 6 reports PENDING for an aggregate-routed dev.build, since RULE 11 step ③ is a cross-repo fact this runner cannot check", async () => {
  const result = await runRepo(
    { org: "openIndu", repo: "openIndu-backend" },
    baseRunRepoOverrides({
      runIntakeFn: async () =>
        fakeIntakeComplete({
          issueCount: 1,
          dev: { build: { aggregate: true } },
        }),
      runPipeline: async () => ({ state: "NO_ACTION" }),
    }),
  );

  assert.equal(result.buildReadiness.status, "PENDING");
  assert.match(result.report, /dev\.build readiness: PENDING/);
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

function runStateWithIssues(issues) {
  return { ...createRunState({ runId: "run-1", repoName: "r" }), issues };
}

test("runAckCommand acks every merged-but-unacked issue in the run, skipping ones already acked or never merged, and saves once", async () => {
  const state = runStateWithIssues({
    1: { merged: true, mergedAt: "2026-10-30T00:00:00.000Z", ackAt: null },
    2: {
      merged: true,
      mergedAt: "2026-10-29T00:00:00.000Z",
      ackAt: "2026-10-29T01:00:00.000Z",
    },
    3: { merged: false, mergedAt: null, ackAt: null },
  });
  let savedPath;
  let savedState;
  const result = await runAckCommand("run-1", {
    findRunStateFile: () => ({
      repo: "r",
      stateFilePath: "/docs/r/state.json",
    }),
    loadState: () => state,
    saveState: (path, newState) => {
      savedPath = path;
      savedState = newState;
    },
    fetchRoute: () =>
      '{"repos": {"r": {"type": "backend"}}, "dev_grants": [{"repos": ["r"], "approved_by": "alice"}]}',
    getCurrentGhLogin: () => "alice",
    isInteractiveTerminal: () => true,
  });

  assert.equal(result.outcome, "ACK_COMPLETE");
  assert.equal(result.exitCode, EXIT_CODES.OK);
  assert.deepEqual(result.ackedIssueNumbers, [1]);
  assert.equal(savedPath, "/docs/r/state.json");
  assert.equal(savedState.issues["1"].ackAt, result.ackAt);
  assert.equal(savedState.issues["2"].ackAt, "2026-10-29T01:00:00.000Z");
  assert.equal(savedState.issues["3"].ackAt, null);
});

test("runAckCommand returns ARGUMENT_ERROR and never calls saveState when no run matches the given run-id", async () => {
  let saveCalled = false;
  const result = await runAckCommand("nonexistent-run", {
    findRunStateFile: () => null,
    saveState: () => {
      saveCalled = true;
    },
  });
  assert.equal(result.outcome, "ARGUMENT_ERROR");
  assert.match(result.reason, /no run found/);
  assert.equal(saveCalled, false);
});

test("runAckCommand picks the dev_grants entry whose repos list actually includes this run's repo, not just the first grant in the array", async () => {
  const state = runStateWithIssues({
    1: { merged: true, mergedAt: "2026-10-30T00:00:00.000Z", ackAt: null },
  });
  const result = await runAckCommand("run-1", {
    findRunStateFile: () => ({
      repo: "r",
      stateFilePath: "/docs/r/state.json",
    }),
    loadState: () => state,
    saveState: () => {},
    fetchRoute: () =>
      JSON.stringify({
        repos: { r: { type: "backend" } },
        dev_grants: [
          { repos: ["other-repo"], approved_by: "bob" },
          { repos: ["r"], approved_by: "alice" },
        ],
      }),
    getCurrentGhLogin: () => "alice",
    isInteractiveTerminal: () => true,
  });
  assert.equal(result.outcome, "ACK_COMPLETE");
});

test("runAckCommand returns ARGUMENT_ERROR when no dev_grants entry authorizes the run's repo", async () => {
  const result = await runAckCommand("run-1", {
    findRunStateFile: () => ({
      repo: "r",
      stateFilePath: "/docs/r/state.json",
    }),
    fetchRoute: () => '{"repos": {"r": {"type": "backend"}}, "dev_grants": []}',
  });
  assert.equal(result.outcome, "ARGUMENT_ERROR");
  assert.match(result.reason, /no dev_grants entry authorizes r/);
});

test("runAckCommand rejects (and never loads or saves state) when the current gh login does not match approved_by", async () => {
  let loadCalled = false;
  let saveCalled = false;
  const result = await runAckCommand("run-1", {
    findRunStateFile: () => ({
      repo: "r",
      stateFilePath: "/docs/r/state.json",
    }),
    loadState: () => {
      loadCalled = true;
      return runStateWithIssues({});
    },
    saveState: () => {
      saveCalled = true;
    },
    fetchRoute: () =>
      '{"repos": {"r": {"type": "backend"}}, "dev_grants": [{"repos": ["r"], "approved_by": "alice"}]}',
    getCurrentGhLogin: () => "mallory",
    isInteractiveTerminal: () => true,
  });
  assert.equal(result.outcome, "ACK_REJECTED");
  assert.equal(result.exitCode, EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR);
  assert.match(result.reason, /not the approver/);
  assert.equal(loadCalled, false);
  assert.equal(saveCalled, false);
});

test("runAckCommand rejects when not run in an interactive terminal", async () => {
  const result = await runAckCommand("run-1", {
    findRunStateFile: () => ({
      repo: "r",
      stateFilePath: "/docs/r/state.json",
    }),
    fetchRoute: () =>
      '{"repos": {"r": {"type": "backend"}}, "dev_grants": [{"repos": ["r"], "approved_by": "alice"}]}',
    getCurrentGhLogin: () => "alice",
    isInteractiveTerminal: () => false,
  });
  assert.equal(result.outcome, "ACK_REJECTED");
  assert.match(result.reason, /interactive terminal/);
});

test("runBuildCommand returns ARGUMENT_ERROR when the repo is not in route.json", async () => {
  const result = await runBuildCommand(
    "ghost-repo",
    {},
    { fetchRoute: () => '{"repos": {}}' },
  );
  assert.equal(result.outcome, "ARGUMENT_ERROR");
  assert.match(result.reason, /ghost-repo is not in route\.json/);
});

test("runBuildCommand reports N/A (and never calls runAggregateRelease) when the repo has no dev.build configured", async () => {
  let releaseCalled = false;
  const result = await runBuildCommand(
    "r",
    { confirm: true },
    {
      fetchRoute: () => '{"repos": {"r": {"type": "backend"}}}',
      runAggregateRelease: () => {
        releaseCalled = true;
        return { imageTag: "x" };
      },
    },
  );
  assert.equal(result.outcome, "BUILD_N/A");
  assert.equal(result.exitCode, EXIT_CODES.PARTIAL);
  assert.equal(releaseCalled, false);
});

test("runBuildCommand reports AWAITING_CONFIRMATION (and never calls runAggregateRelease) when ready but not confirmed", async () => {
  let releaseCalled = false;
  const result = await runBuildCommand(
    "r",
    { confirm: false },
    {
      fetchRoute: () =>
        '{"repos": {"r": {"type": "backend", "dev": {"build": {}}}}}',
      runAggregateRelease: () => {
        releaseCalled = true;
        return { imageTag: "x" };
      },
    },
  );
  assert.equal(result.outcome, "BUILD_AWAITING_CONFIRMATION");
  assert.equal(result.exitCode, EXIT_CODES.PARTIAL);
  assert.equal(releaseCalled, false);
});

test("runBuildCommand calls runAggregateRelease and reports BUILT when ready and confirmed", async () => {
  const calls = [];
  const result = await runBuildCommand(
    "r",
    { confirm: true },
    {
      fetchRoute: () =>
        '{"repos": {"r": {"type": "backend", "dev": {"build": {}}}}}',
      runAggregateRelease: (args) => {
        calls.push(args);
        return { imageTag: "sha-abc123" };
      },
    },
  );
  assert.equal(result.outcome, "BUILD_BUILT");
  assert.equal(result.exitCode, EXIT_CODES.OK);
  assert.equal(result.imageTag, "sha-abc123");
  assert.deepEqual(calls, [{ repoName: "r", devBuildConfig: {} }]);
});

test("runBuildCommand reports PENDING for an aggregate-routed build regardless of confirm, since RULE 11 step ③ cannot be checked from here", async () => {
  const result = await runBuildCommand(
    "r",
    { confirm: true },
    {
      fetchRoute: () =>
        '{"repos": {"r": {"type": "backend", "dev": {"build": {"aggregate": true}}}}}',
      runAggregateRelease: () => ({ imageTag: "x" }),
    },
  );
  assert.equal(result.outcome, "BUILD_PENDING");
  assert.equal(result.exitCode, EXIT_CODES.PARTIAL);
});

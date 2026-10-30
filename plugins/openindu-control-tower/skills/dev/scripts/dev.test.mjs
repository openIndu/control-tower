import assert from "node:assert/strict";
import test from "node:test";

import { gatherAdmissionFacts, parseArgs, runIntake } from "./dev.mjs";

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

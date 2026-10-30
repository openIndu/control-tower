#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  ADMISSION_RESULTS,
  evaluateAdmission,
} from "../../../engine/admission.mjs";
import { EXIT_CODES } from "../../../engine/exit-codes.mjs";
import {
  buildSnapshot,
  checkSourcePermissions,
  formatZeroIssuesReport,
} from "../../../engine/issue-intake.mjs";
import {
  fetchRouteText,
  isStructurallyExcluded,
  parseRoute,
} from "../../../engine/route-reader.mjs";
import { run as collectRepoIssues } from "../../issue-pipeline/scripts/collect-org-issues.mjs";

// spec/005 section 2.1: "`./dev <repo>`（工作区启动器）与 `/dev <repo>`（技能）调用同一
// 个 runner：skills/dev/scripts/dev.mjs". This file IS that runner. Stage 7 (PR-F) builds
// it incrementally: this slice (F8-1) covers the CLI skeleton, route resolution, the
// structural-exclusion gate, admission A1-A3, and step 1 (issue intake) -- steps 2-6 are
// wired in the sub-PRs that follow, each importing the already-built library modules
// from engine/ and skills/issue-pipeline/ rather than duplicating their logic here.

export function parseArgs(argv) {
  const options = {
    org: "openIndu",
    repo: null,
    dryRun: false,
    resume: null,
    noMerge: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--org") options.org = argv[++index];
    else if (argument === "--repo") options.repo = argv[++index];
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--resume") options.resume = argv[++index];
    else if (argument === "--no-merge") options.noMerge = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.help && !options.repo)
    throw new Error("--repo requires a value");
  return options;
}

function ghApi(endpoint, jqFilter) {
  const args = ["api", endpoint];
  if (jqFilter) args.push("--jq", jqFilter);
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// Real default fact-gatherers for admission A1-A3 (engine/admission.mjs, stage 4). Each
// normalizes whatever shape the underlying gh endpoint returns into the uppercase
// SUCCESS/FAILURE convention the rest of engine/ already uses (gh's own
// statusCheckRollup shape, confirmed against a real trace in PR-F1/#37) -- the Statuses
// API's own `state` field comes back lowercase, so it is upper-cased here at the
// boundary rather than pushing that inconsistency into admission.mjs.
export function defaultDefaultBranch(org, repo) {
  return ghApi(`repos/${org}/${repo}`, ".default_branch");
}

export function defaultHasCiWorkflow(org, repo) {
  return (
    Number(ghApi(`repos/${org}/${repo}/actions/workflows`, ".total_count")) > 0
  );
}

export function defaultBranchHeadCiState(org, repo, branch) {
  return ghApi(
    `repos/${org}/${repo}/commits/${branch}/status`,
    ".state",
  ).toUpperCase();
}

export function gatherAdmissionFacts(
  { org, repo },
  {
    defaultBranch = defaultDefaultBranch,
    hasCiWorkflow = defaultHasCiWorkflow,
    headCiState = defaultBranchHeadCiState,
  } = {},
) {
  const branch = defaultBranch(org, repo);
  return {
    defaultBranch: branch,
    hasDefaultBranchCiWorkflow: hasCiWorkflow(org, repo),
    defaultBranchHeadCiState: headCiState(org, repo, branch),
  };
}

// Step 1 (spec/005 section 2.1): resolve route + admission, then collect and
// snapshot this repo's open issues. Everything side-effecting is injected so tests
// never shell out to a real gh/route fetch; dev.mjs's own main() below supplies
// the real defaults declared above.
export async function runIntake(
  { org, repo },
  {
    fetchRoute = (ref) => fetchRouteText(ref),
    collectIssues = collectRepoIssues,
    gatherAdmission = gatherAdmissionFacts,
    sourcePermissions = checkSourcePermissions,
  } = {},
) {
  const route = parseRoute(fetchRoute("main"));
  const repoEntry = route.repos?.[repo];
  if (!repoEntry) {
    return {
      outcome: "ARGUMENT_ERROR",
      exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
      reason: `${repo} is not in route.json`,
    };
  }
  if (isStructurallyExcluded(repoEntry.type)) {
    return {
      outcome: "REJECTED",
      exitCode: EXIT_CODES.REJECTED,
      reason: `structurally excluded type: ${repoEntry.type}`,
    };
  }

  const admissionFacts = gatherAdmission({ org, repo });
  const admission = evaluateAdmission({
    hasDefaultBranchCiWorkflow: admissionFacts.hasDefaultBranchCiWorkflow,
    requiredChecks: repoEntry.dev?.required_checks,
    defaultBranchHeadCiState: admissionFacts.defaultBranchHeadCiState,
  });
  if (admission.result === ADMISSION_RESULTS.REJECTED) {
    return {
      outcome: "REJECTED",
      exitCode: EXIT_CODES.REJECTED,
      reason: admission.reasons.join("; "),
    };
  }

  const collected = collectIssues({ org, repo, state: "open" });
  if (collected.issueCount === 0) {
    return {
      outcome: "NO_ACTION",
      exitCode: EXIT_CODES.OK,
      report: formatZeroIssuesReport(repo),
    };
  }

  const issuesWithSourceFacts = collected.issues.map((issue) => ({
    issue,
    sourceFacts: sourcePermissions({
      repoPath: `${org}/${repo}`,
      authorLogin: issue.author,
      commenterLogins: [],
    }),
  }));

  return {
    outcome: "INTAKE_COMPLETE",
    admissionResult: admission.result,
    repoEntry,
    snapshot: buildSnapshot(issuesWithSourceFacts),
    issues: collected.issues,
  };
}

function usage() {
  return "Usage: dev.mjs --repo NAME [--org openIndu] [--dry-run] [--resume RUN_ID] [--no-merge]";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = await runIntake(options);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode ?? EXIT_CODES.OK;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR;
  });
}

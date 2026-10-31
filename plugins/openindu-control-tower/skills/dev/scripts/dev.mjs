#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ADMISSION_RESULTS,
  evaluateAdmission,
} from "../../../engine/admission.mjs";
import {
  buildCarrierCallbacks,
  setupSystemPrompt,
} from "../../../engine/carrier-setup.mjs";
import { DEFAULT_PAUSE_FILE_NAME } from "../../../engine/dev-pause.mjs";
import {
  resolveDocsDir,
  resolveRepoDocsDir,
} from "../../../engine/docs-dir.mjs";
import { EXIT_CODES, exitCodeForStates } from "../../../engine/exit-codes.mjs";
import {
  buildSnapshot,
  checkSourcePermissions,
  formatZeroIssuesReport,
} from "../../../engine/issue-intake.mjs";
import { runIssuePipeline } from "../../../engine/issue-pipeline.mjs";
import { buildRealStep4Deps } from "../../../engine/real-step4-deps.mjs";
import {
  fetchRouteText,
  isStructurallyExcluded,
  parseRoute,
  resolveRepoAuthorization,
} from "../../../engine/route-reader.mjs";
import { buildRepoRunContext } from "../../../engine/run-context.mjs";
import {
  defaultRepoClonePath,
  defaultWorktreeBaseDir,
  ensureRepoClone,
  issueWorktreePath,
} from "../../../engine/worktree.mjs";
import { run as collectRepoIssues } from "../../issue-pipeline/scripts/collect-org-issues.mjs";

// This runner lives at <repo-root>/plugins/openindu-control-tower/skills/dev/scripts/dev.mjs
// -- 5 directories below the repo root -- which is also the control-tower checkout
// carrier-setup.mjs's setupSystemPrompt reads the principle SKILL.md from (RULE 1's text
// is injected into every carrier call's system prompt, not just read once at startup).
export const CONTROL_TOWER_REPO_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
);

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
    // spec/005 section 2.1: "--max-issues（默认 10）" -- a safety bound on
    // how many issues a single invocation will act on, not an opt-in.
    maxIssues: 10,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--org") options.org = argv[++index];
    else if (argument === "--repo") options.repo = argv[++index];
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--resume") options.resume = argv[++index];
    else if (argument === "--no-merge") options.noMerge = true;
    else if (argument === "--max-issues")
      options.maxIssues = Number(argv[++index]);
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
  // spec/005 section 2.4: dev.enabled defaults to false ("是否允许 /dev 操作该
  // 仓（PR-only 也算操作）"); section 2.3-2's exit-3 list names it alongside
  // structural exclusion and A1 ("排除类型、未启用、A1 不满足"), so this is a
  // REJECTED short-circuit, not a PR_ONLY admission result -- a repo that has
  // never opted in gets no action at all, not even an opened PR.
  if (repoEntry.dev?.enabled !== true) {
    return {
      outcome: "REJECTED",
      exitCode: EXIT_CODES.REJECTED,
      reason: "dev.enabled is not true for this repo",
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
    route,
    repoEntry,
    defaultBranch: admissionFacts.defaultBranch,
    snapshot: buildSnapshot(issuesWithSourceFacts),
    issues: collected.issues,
  };
}

// Step 2-4 (spec/005 section 2.1): given an INTAKE_COMPLETE result from
// runIntake, clone the repo once, set up the one shared system prompt, then
// run every issue (up to --max-issues) through the real pipeline --
// issue-pipeline.mjs's runIssuePipeline, wired to carrier-setup.mjs's real
// carrier callbacks (#61) and real-step4-deps.mjs's real buildStep4Deps
// (#60). Everything side-effecting is injected, same convention as
// runIntake; main()'s own call below supplies the real defaults.
//
// Deliberately NOT yet wired here, each a stated gap rather than a silent
// one: --dry-run (refused explicitly below, rather than silently running
// the full pipeline under a flag that promises zero GitHub writes);
// --max-total-budget-usd and trace-log persistence (budget-tracking.mjs's
// withCostTracking / trace-log.mjs's withTraceLogging exist but are not
// yet wrapped around these callbacks); run-state persistence, the run
// lock, and --resume (run-state.mjs exists but nothing here reads or
// writes a state.json yet, so every call passes a fresh {} resumeIssueState
// and a null resumePrNumber); and step 5/6 sequencing + the final report.
export async function runRepo(options, overrides = {}) {
  const {
    runIntakeFn = runIntake,
    ensureClone = ensureRepoClone,
    worktreeBaseDir = defaultWorktreeBaseDir(),
    resolveDocsDirFn = resolveDocsDir,
    resolveRepoDocsDirFn = resolveRepoDocsDir,
    generateRunId = () => randomUUID(),
    setupPrompt = setupSystemPrompt,
    controlTowerRepoPath = CONTROL_TOWER_REPO_ROOT,
    controlTowerRef = "main",
    grantPrincipleRef = "main",
    resolveApprovers,
    runPipeline = runIssuePipeline,
    buildStep4DepsFn = buildRealStep4Deps,
  } = overrides;

  const intakeResult = await runIntakeFn(options, overrides);
  if (intakeResult.outcome !== "INTAKE_COMPLETE") {
    return intakeResult;
  }

  if (options.dryRun) {
    return {
      outcome: "NOT_YET_IMPLEMENTED",
      exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
      reason:
        "--dry-run is not wired yet -- refusing to silently run the full pipeline under a flag that promises zero GitHub writes",
    };
  }

  const { org, repo } = options;
  const { route, repoEntry, defaultBranch, snapshot } = intakeResult;
  const runId = options.resume ?? generateRunId();
  const baseRef = `origin/${defaultBranch}`;
  const repoClonePath = defaultRepoClonePath(worktreeBaseDir, org, repo);
  const docsDir = resolveDocsDirFn(repo, runId);
  const devChecks = repoEntry.dev?.checks ?? [];

  ensureClone({ org, repo, clonePath: repoClonePath });

  const systemPromptFilePath = setupPrompt({
    controlTowerRepoPath,
    repoClonePath,
    promptDir: join(worktreeBaseDir, runId),
  });

  const baseRunContext = buildRepoRunContext(
    {
      org,
      repo,
      baseRef,
      defaultBranch,
      docsDir,
      controlTowerRepoPath,
      controlTowerRef,
      grantPrincipleRef,
      repoEntry,
    },
    resolveApprovers ? { resolveApprovers } : {},
  );

  // G11 / spec/005 section 2.3-2: a repo with no live dev_grant, or one
  // whose grant has expired, still gets real PRs opened and reviewed --
  // it just never auto-merges. --no-merge forces the same stop regardless
  // of grant state.
  const authorization = resolveRepoAuthorization(route, repo);
  const stopAfterCiGreen = options.noMerge || !authorization.authorized;
  const pauseFilePath = join(
    resolveRepoDocsDirFn(repo),
    DEFAULT_PAUSE_FILE_NAME,
  );

  const results = [];
  for (const issue of snapshot.issues.slice(0, options.maxIssues ?? 10)) {
    const worktreePath = issueWorktreePath({
      baseDir: worktreeBaseDir,
      runId,
      issueNumber: issue.number,
    });
    // A sibling of the issue's worktree, never nested inside it -- nothing
    // here should risk being swept up by a `git add -A` run inside the
    // worktree. Scoped per issue (not shared across the run) because
    // carrier-callbacks.mjs's buildRealGenerateProposal names its prompt
    // file only by strategy ("proposal-<strategy>.txt"), with no issue
    // number in it -- two issues sharing one promptDir could collide.
    const carrierContext = {
      worktreePath,
      systemPromptFilePath,
      promptDir: join(worktreeBaseDir, runId, `issue-${issue.number}-prompts`),
      allowedToolCommands: devChecks,
    };
    const callbacks = buildCarrierCallbacks(carrierContext);
    const issueRunContext = {
      ...baseRunContext,
      carrier: carrierContext,
      resumePrNumber: null,
    };

    const result = await runPipeline(
      issue,
      {
        repoClonePath,
        worktreeBaseDir,
        runId,
        baseRef,
        devChecks,
        resumeIssueState: {},
        pauseFilePath,
        stopAfterCiGreen,
      },
      {
        ...callbacks,
        buildStep4Deps: (issueArgs) =>
          buildStep4DepsFn(issueRunContext, issueArgs),
      },
    );
    results.push({ issueNumber: issue.number, ...result });
  }

  return {
    outcome: "RUN_COMPLETE",
    exitCode: exitCodeForStates(results.map((result) => result.state)),
    runId,
    results,
  };
}

function usage() {
  return "Usage: dev.mjs --repo NAME [--org openIndu] [--dry-run] [--resume RUN_ID] [--no-merge] [--max-issues N]";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = await runRepo(options);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode ?? EXIT_CODES.OK;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR;
  });
}

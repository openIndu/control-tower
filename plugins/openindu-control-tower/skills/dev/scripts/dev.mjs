#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { evaluateAck } from "../../../engine/ack.mjs";
import {
  ADMISSION_RESULTS,
  evaluateAdmission,
} from "../../../engine/admission.mjs";
import { createBudgetTracker } from "../../../engine/budget-tracking.mjs";
import { buildRealSummarizeAcceptanceCriteria } from "../../../engine/carrier-callbacks.mjs";
import {
  buildCarrierCallbacks,
  setupSystemPrompt,
  withTrackingWrappers,
} from "../../../engine/carrier-setup.mjs";
import { DEFAULT_PAUSE_FILE_NAME } from "../../../engine/dev-pause.mjs";
import {
  resolveDocsBaseDir,
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
import {
  evaluateBuildReadiness,
  renderRule11StatusChecklist,
  runBuildStep,
} from "../../../engine/build-step.mjs";
import {
  createVerificationWorktree,
  defaultReadLocalServiceEnvText,
  generateVerifyChecklist,
  PointsAtProductionError,
  probeHealth,
  startLocalService,
  writeVerifyChecklist,
} from "../../../engine/local-service.mjs";
import { buildRepoRunContext } from "../../../engine/run-context.mjs";
import {
  computeOutcomeRates,
  computeRollbackRate,
  renderRunReport,
} from "../../../engine/run-report.mjs";
import {
  acquireRunLock,
  createRunState,
  getIssueState,
  loadRunState,
  markAcked,
  markMerged,
  markPrOpened,
  releaseRunLock,
  RunLockHeldError,
  saveRunState,
} from "../../../engine/run-state.mjs";
import { defaultFetchDefaultBranchCommitMessages } from "../../../engine/step4-callbacks.mjs";
import { appendTraceEntry, traceFileName } from "../../../engine/trace-log.mjs";
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
    // spec/005 section 2.1/2.6: "--max-total-budget-usd（单次运行总预算）" --
    // null means no cap (budget-tracking.mjs's createBudgetTracker treats a
    // null maxTotalUsd as "never exceeded"), not zero.
    maxTotalBudgetUsd: null,
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
    else if (argument === "--max-total-budget-usd")
      options.maxTotalBudgetUsd = Number(argv[++index]);
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
// --dry-run (spec/005 section 2.1: "做到步骤 2 为止，对 GitHub 零写入") shares
// this same loop -- the clone, the one shared system prompt, the per-issue
// carrier context/promptDir, and the budget tracker are identical either
// way -- but never touches run-state.mjs at all: nothing a dry run does is
// resumable (step 3/4 never run, so there is no PR/merge progress to save),
// so isDryRun skips loadState/createRunState/getIssueState/markPrOpened/
// markMerged/saveState entirely, and --dry-run with --resume together is
// refused explicitly below rather than silently ignoring --resume.
//
// promotedToReady is deliberately NOT tracked here, unlike openedPr/merged:
// pr-lifecycle.mjs's promoteToReady is `gh pr ready <N>`, which is a safe
// no-op on an already-ready PR, so a resumed run re-promoting is harmless
// -- openedPr/merged get tracked because their real counterparts
// (commitAndPush+openPr, and an actual merge) are not safe to repeat.
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
    acquireLock = acquireRunLock,
    releaseLock = releaseRunLock,
    loadState = loadRunState,
    saveState = saveRunState,
    createBudget = createBudgetTracker,
    appendTrace = appendTraceEntry,
    fetchCommitMessages = defaultFetchDefaultBranchCommitMessages,
    createVerifyWorktree = createVerificationWorktree,
    readLocalServiceEnvText = defaultReadLocalServiceEnvText,
    startService = startLocalService,
    probeServiceHealth = probeHealth,
    generateChecklist = generateVerifyChecklist,
    writeChecklist = writeVerifyChecklist,
    buildSummarizeAcceptanceCriteria = buildRealSummarizeAcceptanceCriteria,
  } = overrides;

  const intakeResult = await runIntakeFn(options, overrides);
  if (intakeResult.outcome !== "INTAKE_COMPLETE") {
    return intakeResult;
  }

  if (options.dryRun && options.resume) {
    return {
      outcome: "ARGUMENT_ERROR",
      exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
      reason:
        "--dry-run and --resume cannot be combined -- a dry run never writes state.json, so there is nothing for --resume to load",
    };
  }
  const isDryRun = Boolean(options.dryRun);

  const { org, repo } = options;
  const { route, repoEntry, defaultBranch, snapshot } = intakeResult;
  const runId = options.resume ?? generateRunId();
  const baseRef = `origin/${defaultBranch}`;
  const repoClonePath = defaultRepoClonePath(worktreeBaseDir, org, repo);
  const docsDir = resolveDocsDirFn(repo, runId);
  const devChecks = repoEntry.dev?.checks ?? [];

  // spec/005 section 2.1: "同一仓同时只允许一个运行（锁文件）". Repo-scoped
  // (not run-scoped), so it lives alongside .dev-pause rather than inside
  // this run's own docsDir -- its job is to block a DIFFERENT run (a
  // different runId) from starting concurrently against the same repo;
  // acquireRunLock itself is idempotent for the SAME runId, which is
  // exactly what --resume needs.
  const lockFilePath = join(resolveRepoDocsDirFn(repo), ".dev-run.lock");
  try {
    acquireLock(lockFilePath, runId);
  } catch (error) {
    if (error instanceof RunLockHeldError) {
      return {
        outcome: "RUN_LOCKED",
        exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
        reason: `another run (${error.heldByRunId}) already holds the lock for ${repo}`,
      };
    }
    throw error;
  }

  try {
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
    // it just never auto-merges. --no-merge forces the same stop
    // regardless of grant state.
    const authorization = resolveRepoAuthorization(route, repo);
    const stopAfterCiGreen = options.noMerge || !authorization.authorized;
    const pauseFilePath = join(
      resolveRepoDocsDirFn(repo),
      DEFAULT_PAUSE_FILE_NAME,
    );
    const stateFilePath = join(docsDir, "state.json");

    // --resume loads the SAME runId's state back from the SAME docsDir a
    // prior invocation wrote it to; a fresh run starts from an empty one.
    // A dry run never reads or writes this at all (see the header comment).
    let runState = isDryRun
      ? null
      : options.resume
        ? loadState(stateFilePath)
        : createRunState({ runId, repoName: repo });

    // One tracker for the WHOLE run (spec/005: "--max-total-budget-usd
    // 单次运行总预算"), shared across every issue -- an earlier issue's
    // spend counts against a later one's budget, not reset per issue.
    const budgetTracker = createBudget(options.maxTotalBudgetUsd);

    const results = [];
    for (const issue of snapshot.issues.slice(0, options.maxIssues ?? 10)) {
      // Checked before STARTING a new issue, not before every call within
      // one -- an issue already in progress runs to its natural
      // completion; the cap only stops the loop from picking up a new one.
      if (budgetTracker.exceeded) break;

      const worktreePath = issueWorktreePath({
        baseDir: worktreeBaseDir,
        runId,
        issueNumber: issue.number,
      });
      // A sibling of the issue's worktree, never nested inside it --
      // nothing here should risk being swept up by a `git add -A` run
      // inside the worktree. Scoped per issue (not shared across the run)
      // because carrier-callbacks.mjs's buildRealGenerateProposal names
      // its prompt file only by strategy ("proposal-<strategy>.txt"),
      // with no issue number in it -- two issues sharing one promptDir
      // could collide.
      const carrierContext = {
        worktreePath,
        systemPromptFilePath,
        promptDir: join(
          worktreeBaseDir,
          runId,
          `issue-${issue.number}-prompts`,
        ),
        allowedToolCommands: devChecks,
      };
      const callbacks = withTrackingWrappers(
        buildCarrierCallbacks(carrierContext),
        {
          addCost: budgetTracker.addCost,
          appendTrace: (entry) =>
            appendTrace(docsDir, traceFileName(issue.number), entry),
        },
      );
      const resumeIssueState = isDryRun
        ? {}
        : getIssueState(runState, issue.number);
      const issueRunContext = {
        ...baseRunContext,
        carrier: carrierContext,
        resumePrNumber: resumeIssueState.prNumber ?? null,
      };

      const result = await runPipeline(
        issue,
        {
          repoClonePath,
          worktreeBaseDir,
          runId,
          baseRef,
          devChecks,
          resumeIssueState,
          pauseFilePath,
          stopAfterCiGreen,
          stopAfterStep2: isDryRun,
        },
        {
          ...callbacks,
          buildStep4Deps: (issueArgs) =>
            buildStep4DepsFn(issueRunContext, issueArgs),
        },
      );

      if (!isDryRun) {
        if (result.prNumber) {
          runState = markPrOpened(runState, issue.number, result.prNumber);
        }
        if (result.state === "MERGED") {
          runState = markMerged(runState, issue.number, {
            mergeSha: result.mergeCommit,
          });
        }
        saveState(stateFilePath, runState);
      }

      results.push({ issueNumber: issue.number, ...result });
    }

    if (isDryRun) {
      // Dry-run results have no `state` at all unless tier resolution sent
      // them to HUMAN_REQUIRED before step 2 ever ran (see
      // issue-pipeline.mjs) -- exitCodeForStates would throw on the
      // undefined ones, so this checks directly rather than reusing it.
      const anyHumanRequired = results.some(
        (result) => result.state === "HUMAN_REQUIRED",
      );
      return {
        outcome: "DRY_RUN_COMPLETE",
        exitCode: anyHumanRequired ? EXIT_CODES.PARTIAL : EXIT_CODES.OK,
        runId,
        results,
        budgetExceeded: budgetTracker.exceeded,
        spentUsd: budgetTracker.spentUsd,
      };
    }

    // spec/005 section 2.1 step 5: runs once per repo after the per-issue
    // loop (never per issue), against a single verification worktree on the
    // current default branch -- not the dry-run path above, since nothing
    // merged for there to be anything new to verify. Informational: a
    // startLocalService/probeHealth failure is caught and reported rather
    // than thrown, so it never erases the per-issue results already in
    // `results` (AGENTS.md rule 4 -- surface the error, don't silently treat
    // it as success -- is satisfied by reporting it, not by crashing the
    // whole run and losing everything that already succeeded).
    const localServiceConfig = repoEntry.dev?.local_service ?? null;
    let localServiceResult;
    if (!localServiceConfig) {
      localServiceResult = {
        attempted: false,
        reason: "dev.local_service is not configured for this repo",
      };
    } else {
      const verifyWorktreePath = join(worktreeBaseDir, runId, "verify");
      try {
        createVerifyWorktree({
          repoPath: repoClonePath,
          worktreePath: verifyWorktreePath,
          defaultBranch,
        });
        const started = startService({
          worktreePath: verifyWorktreePath,
          buildCommand: localServiceConfig.build_command,
          startCommand: localServiceConfig.start_command,
          resolvedEnvText: readLocalServiceEnvText(verifyWorktreePath),
          forbiddenEnvPatterns: localServiceConfig.forbidden_env_patterns ?? [],
        });
        const health = await probeServiceHealth({
          healthCheckUrl: localServiceConfig.health_check_url,
        });
        const mergedIssueNumbers = new Set(
          results
            .filter((result) => result.state === "MERGED")
            .map((result) => result.issueNumber),
        );
        const mergedIssues = snapshot.issues.filter((issue) =>
          mergedIssueNumbers.has(issue.number),
        );
        let checklistPath = null;
        if (mergedIssues.length > 0) {
          const summarizeAcceptanceCriteria = buildSummarizeAcceptanceCriteria({
            worktreePath: verifyWorktreePath,
            systemPromptFilePath,
            promptDir: join(worktreeBaseDir, runId, "verify-prompts"),
          });
          const checklistMarkdown = await generateChecklist(
            mergedIssues,
            summarizeAcceptanceCriteria,
          );
          checklistPath = join(docsDir, "verify-checklist.md");
          writeChecklist(checklistPath, checklistMarkdown);
        }
        localServiceResult = {
          attempted: true,
          healthy: health.healthy,
          pid: started.pid,
          checklistPath,
        };
      } catch (error) {
        localServiceResult = {
          attempted: true,
          healthy: false,
          blockedByProductionCheck: error instanceof PointsAtProductionError,
          error: error.message,
        };
      }
    }

    // spec/005 section 2.1 step 6: readiness info only, feeding the report's
    // RULE 11 section -- never auto-runs runBuildStep (build-step.mjs's own
    // header: step 6 "only runs after explicit user confirmation", which
    // only ./dev build's own subcommand can supply). rule11Status is
    // deliberately undefined -- whether RULE 11 step ③ (the aggregate
    // repo's submodule-pointer PR) has merged is a cross-repo fact this
    // runner has no mechanism to check from here, and
    // evaluateBuildReadiness's own `rule11Status?.submodulePointerMerged`
    // optional-chains that into a conservative PENDING rather than a wrong
    // READY_TO_BUILD. This is one axis of RULE 11 (⑥'s own readiness), not
    // the full ③-⑥ breakdown -- the other steps are cross-repo facts this
    // runner cannot observe, so they are left out rather than fabricated.
    const buildReadiness = evaluateBuildReadiness(
      repoEntry.dev?.build ?? null,
      undefined,
    );
    const rule11Checklist = renderRule11StatusChecklist([
      {
        step: "⑥",
        label: `dev.build readiness: ${buildReadiness.status}${
          buildReadiness.reason ? ` (${buildReadiness.reason})` : ""
        }`,
        status: buildReadiness.status === "BUILT" ? "done" : "pending",
      },
    ]);

    // spec/005 section 6 criteria #15/#16: the per-issue matrix and the
    // degradation/human-correction/rollback rates, computed from this run's
    // own results -- recordedMerges/commitMessages are only fetched when
    // something in this run actually merged, since computeRollbackRate is
    // trivially 0 otherwise and a fetch+log round trip would be wasted work.
    const outcomeRates = computeOutcomeRates(
      results.map((result) => ({
        issueNumber: result.issueNumber,
        state: result.state,
      })),
    );
    const recordedMerges = results
      .filter((result) => result.state === "MERGED")
      .map((result) => ({
        issueNumber: result.issueNumber,
        mergeSha: result.mergeCommit,
      }));
    const commitMessages =
      recordedMerges.length > 0
        ? fetchCommitMessages(repoClonePath, defaultBranch)
        : [];
    const rollbackRate = computeRollbackRate(recordedMerges, commitMessages);
    const report = renderRunReport({
      issueResults: results,
      outcomeRates,
      rollbackRate,
      rule11Checklist,
      localServiceResult,
    });

    return {
      outcome: "RUN_COMPLETE",
      exitCode: exitCodeForStates(results.map((result) => result.state)),
      runId,
      results,
      budgetExceeded: budgetTracker.exceeded,
      spentUsd: budgetTracker.spentUsd,
      localServiceResult,
      buildReadiness,
      report,
    };
  } finally {
    releaseLock(lockFilePath, runId);
  }
}

// Scans every repo's dev-runs directory for runId, since ./dev ack <run-id>
// (spec/005 section 2.1) takes only a run-id -- the caller is not expected
// to already know which repo it belongs to. Returns null rather than
// throwing on a miss; runAckCommand turns that into an ARGUMENT_ERROR.
function defaultFindRunStateFile(runId, env = process.env) {
  const baseDir = resolveDocsBaseDir(env);
  if (!existsSync(baseDir)) return null;
  for (const repo of readdirSync(baseDir)) {
    const stateFilePath = join(baseDir, repo, "dev-runs", runId, "state.json");
    if (existsSync(stateFilePath)) {
      return { repo, stateFilePath };
    }
  }
  return null;
}

function defaultGetCurrentGhLogin() {
  return ghApi("user", ".login");
}

function defaultIsInteractiveTerminal() {
  return Boolean(process.stdout.isTTY);
}

// spec/005 section 2.3-6: "./dev ack <run-id>" -- the approved_by maintainer
// confirms a run's merges by running this themself, in an interactive
// terminal, under the matching gh login. Acks every issue in the run that
// has merged but not yet been acked (ack.mjs's evaluateAck/markAcked are
// per-issue -- see run-state.mjs's issue-state shape -- so one invocation
// naturally covers every merge this run made, not just one issue).
export async function runAckCommand(
  runId,
  {
    findRunStateFile = defaultFindRunStateFile,
    loadState = loadRunState,
    saveState = saveRunState,
    fetchRoute = (ref) => fetchRouteText(ref),
    getCurrentGhLogin = defaultGetCurrentGhLogin,
    isInteractiveTerminal = defaultIsInteractiveTerminal,
  } = {},
) {
  const found = findRunStateFile(runId);
  if (!found) {
    return {
      outcome: "ARGUMENT_ERROR",
      exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
      reason: `no run found with id ${runId}`,
    };
  }
  const { repo, stateFilePath } = found;

  const route = parseRoute(fetchRoute("main"));
  const grant = (route.dev_grants ?? []).find((g) => g.repos?.includes(repo));
  if (!grant) {
    return {
      outcome: "ARGUMENT_ERROR",
      exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
      reason: `no dev_grants entry authorizes ${repo} -- nothing to ack`,
    };
  }

  const ackResult = evaluateAck({
    currentGhLogin: getCurrentGhLogin(),
    approvedBy: grant.approved_by,
    isInteractiveTerminal: isInteractiveTerminal(),
  });
  if (!ackResult.accepted) {
    return {
      outcome: "ACK_REJECTED",
      exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
      reason: ackResult.reason,
    };
  }

  let state = loadState(stateFilePath);
  const ackedIssueNumbers = [];
  for (const [issueNumber, issueState] of Object.entries(state.issues ?? {})) {
    if (issueState.mergedAt && !issueState.ackAt) {
      state = markAcked(state, issueNumber, { ackAt: ackResult.ackAt });
      ackedIssueNumbers.push(Number(issueNumber));
    }
  }
  saveState(stateFilePath, state);

  return {
    outcome: "ACK_COMPLETE",
    exitCode: EXIT_CODES.OK,
    runId,
    repo,
    ackedIssueNumbers,
    ackAt: ackResult.ackAt,
  };
}

function defaultRunAggregateRelease() {
  throw new Error(
    "runAggregateRelease has no real implementation in control-tower yet -- build-step.mjs's own header note says that mechanism lives in the aggregate repo, out of scope here. Inject a real callback to actually build.",
  );
}

// spec/005 section 2.1/2.3-6: "./dev build <repo>" -- step 6, a separate
// subcommand from the automatic per-issue loop, gated on userConfirmed
// (build-step.mjs's runBuildStep itself refuses to build without it).
// rule11Status is passed as undefined for the same reason runRepo's own
// step-6 wiring does (see dev.mjs's RUN_COMPLETE block): whether RULE 11
// step ③ has merged is a cross-repo fact this runner cannot check from
// here, and evaluateBuildReadiness's own optional-chained read already
// turns that into a conservative PENDING rather than a wrong
// READY_TO_BUILD.
export async function runBuildCommand(
  repo,
  { confirm = false } = {},
  overrides = {},
) {
  const {
    fetchRoute = (ref) => fetchRouteText(ref),
    runAggregateRelease = defaultRunAggregateRelease,
  } = overrides;

  const route = parseRoute(fetchRoute("main"));
  const repoEntry = route.repos?.[repo];
  if (!repoEntry) {
    return {
      outcome: "ARGUMENT_ERROR",
      exitCode: EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR,
      reason: `${repo} is not in route.json`,
    };
  }

  const result = await runBuildStep(
    {
      repoName: repo,
      devBuildConfig: repoEntry.dev?.build ?? null,
      rule11Status: undefined,
      userConfirmed: confirm,
    },
    { runAggregateRelease },
  );

  return {
    outcome: `BUILD_${result.status}`,
    exitCode: result.status === "BUILT" ? EXIT_CODES.OK : EXIT_CODES.PARTIAL,
    ...result,
  };
}

function usage() {
  return [
    "Usage: dev.mjs --repo NAME [--org openIndu] [--dry-run] [--resume RUN_ID] [--no-merge] [--max-issues N] [--max-total-budget-usd N]",
    "       dev.mjs ack <run-id>",
    "       dev.mjs build <repo> [--confirm]",
  ].join("\n");
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv[0] === "ack") {
    const runId = argv[1];
    if (!runId) {
      console.error(usage());
      process.exitCode = EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR;
      return;
    }
    const result = await runAckCommand(runId);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.exitCode ?? EXIT_CODES.OK;
    return;
  }

  if (argv[0] === "build") {
    const repo = argv[1];
    if (!repo) {
      console.error(usage());
      process.exitCode = EXIT_CODES.ARGUMENT_OR_INTERNAL_ERROR;
      return;
    }
    const result = await runBuildCommand(repo, {
      confirm: argv.includes("--confirm"),
    });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.exitCode ?? EXIT_CODES.OK;
    return;
  }

  const options = parseArgs(argv);
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

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  buildAppendSystemPrompt,
  buildDockerComposeRunArgs,
} from "./carrier/invoker.mjs";
import { invokeAgent } from "./carrier/run-agent.mjs";

// Real generateProposal/reviewProposal for F3's proposal-review.mjs, built on top
// of F1's invokeAgent rather than duplicating any carrier-invocation logic. Every
// side effect (writing a prompt file, the actual docker compose call) is injected
// or passed a real default, same DI pattern as every other engine/ module.

// spec/005 section 2.6: "--max-budget-usd 约束单次调用，runner 另管单次运行总预算"
// -- the spec deliberately leaves the per-call figure to the runner's own policy.
// A plan/review call is a short written judgment, not a coding task, so this is
// set low; it is a documented default, not a value the spec mandates.
export const DEFAULT_PLAN_REVIEW_BUDGET_USD = 1.0;

// implement/fix are coding tasks (read files, write files, run the repo's own
// build/test/lint commands), not a short written judgment -- a documented,
// higher default for the same reason DEFAULT_PLAN_REVIEW_BUDGET_USD is low.
export const DEFAULT_IMPLEMENT_FIX_BUDGET_USD = 5.0;

// guards-core.mjs's guardG4 compares the PR's actual changed paths against
// declaredPlanPaths -- a pre-declared scope boundary, not something derived
// from the diff it is checked against (that would make the guard vacuous).
// Before this field existed, nothing supplied guardG4 a real value at all.
// A winning proposal's declaredPaths is this run's only source for it: the
// proposal is "the plan" step 2 solidifies into, and plan-solidification.mjs/
// implement-review.mjs already pass the winner through by reference with no
// exact-shape check on it (confirmed), so this field reaches step 4's real
// buildStep4Deps with no other module needing to change.
const PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    declaredPaths: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "declaredPaths"],
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    mustFix: { type: "array", items: { type: "string" } },
  },
  required: ["score"],
};

// local-service.mjs's generateVerifyChecklist() summarizeAcceptanceCriteria()
// callback contract: returns the checklistItems array directly (not wrapped),
// per that function's own usage (`for (const item of checklistItems)`).
const ACCEPTANCE_CRITERIA_SCHEMA = {
  type: "object",
  properties: {
    checklistItems: { type: "array", items: { type: "string" } },
  },
  required: ["checklistItems"],
};

// implement-review.mjs's runStep3() review() callback contract: {mustFixItems}
// -- a different field name than step 2's REVIEW_SCHEMA.mustFix, because this
// reviews the actual diff, not a written proposal, and runStep3 only ever reads
// result.mustFixItems (never a score) -- see implement-review.mjs's own review()
// call site.
const IMPLEMENT_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    mustFixItems: { type: "array", items: { type: "string" } },
  },
  required: ["mustFixItems"],
};

// tier-resolution.mjs's resolveTier() contract: the scoping proposal must
// self-declare enough to run review-panel.mjs's baselineTier/applyLlmTierSignal/
// requiresHumanForL3Action without any other data source (see that module's own
// comment for why this call's self-assessment doubles as the tier-escalation
// signal).
const SCOPING_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    estimatedLines: { type: "number" },
    moduleCount: { type: "number" },
    isDocsOrConfigOnly: { type: "boolean" },
    touchesSensitiveArea: { type: "boolean" },
    riskTier: { type: "string", enum: ["L0", "L1", "L2", "L3"] },
    declaredActionTypes: { type: "array", items: { type: "string" } },
    suggestedTier: {
      type: ["string", "null"],
      enum: ["lite", "standard", "high-risk", null],
    },
    confidence: { type: "number" },
    reviewerStatedUncertain: { type: "boolean" },
    acceptanceCriteriaCrowdDerived: { type: "boolean" },
  },
  required: [
    "summary",
    "estimatedLines",
    "moduleCount",
    "isDocsOrConfigOnly",
    "touchesSensitiveArea",
    "riskTier",
    "declaredActionTypes",
    "confidence",
    "reviewerStatedUncertain",
    "acceptanceCriteriaCrowdDerived",
  ],
};

// rule1AnchorText is a fixed literal, not injected -- every carrier invocation in
// this runner anchors on the same instruction (AGENTS.md Rule #1), so there is
// nothing for a caller to usefully vary here.
const RULE1_ANCHOR_TEXT =
  "You are an autonomous agent acting inside a sandboxed carrier with no network access beyond api.anthropic.com. Before taking any action, you must load and follow the openIndu agent principles given below in full. You have no push/merge capability and no credentials of your own; stay within the role you are given.";

export function buildSystemPromptText({
  principleText,
  repoClaudeMd,
  repoAgentsMd,
}) {
  return buildAppendSystemPrompt({
    rule1AnchorText: RULE1_ANCHOR_TEXT,
    principleText,
    repoClaudeMd,
    repoAgentsMd,
  });
}

function writeTextFile(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

function parseStructuredResponse(invokeResult) {
  if (!invokeResult.success) {
    throw new Error(
      `carrier invocation did not succeed (subtype=${invokeResult.subtype ?? "unknown"}): ${JSON.stringify(invokeResult.errors ?? [])}`,
    );
  }
  if (!invokeResult.text) {
    throw new Error(
      "carrier invocation succeeded but returned no text to parse",
    );
  }
  const parsed = JSON.parse(invokeResult.text);
  // spec/005 section 2.6: "--max-budget-usd 约束单次调用，runner 另管单次运行总预算"
  // -- the runner needs each call's actual cost to track that total. Additive
  // and conditional on the key being present at all (invokeAgent/
  // parseStreamJsonResult always sets it, a number or null, on the success
  // path already confirmed above) so a bare {success, text} fake that models
  // no cost at all -- every pre-existing test in this file -- sees no change
  // to its result shape.
  let result =
    invokeResult.costUsd !== undefined
      ? { ...parsed, costUsd: invokeResult.costUsd }
      : parsed;
  // spec/005 section 6 criterion #16: trace-log.mjs's withTraceLogging reads
  // rawStdout to redact and persist. Same conditional-on-presence shape as
  // costUsd above, for the same reason: a bare test fake carries neither key.
  if (invokeResult.rawStdout !== undefined) {
    result = { ...result, rawStdout: invokeResult.rawStdout };
  }
  return result;
}

// implement/fix have no structured output to parse (they write files and run
// shell commands; nothing downstream reads their return value -- see
// implement-review.mjs's runStep3, which awaits implement()/fix() without
// capturing a result), but a failed carrier call must still surface as a
// thrown error, not a silent no-op.
function assertInvokeSucceeded(invokeResult) {
  if (!invokeResult.success) {
    throw new Error(
      `carrier invocation did not succeed (subtype=${invokeResult.subtype ?? "unknown"}): ${JSON.stringify(invokeResult.errors ?? [])}`,
    );
  }
  return invokeResult;
}

function defaultComputeWorkingTreeDiff(worktreePath) {
  return execFileSync("git", ["diff", "HEAD"], {
    cwd: worktreePath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// context: { worktreePath, systemPromptFilePath, promptDir, maxBudgetUsd }.
// systemPromptFilePath must already exist on disk (the caller writes
// buildSystemPromptText's output there once per issue, not once per proposal --
// this function only reads its path, never its content).
export function buildRealGenerateProposal(
  context,
  { invoke = invokeAgent } = {},
) {
  const {
    worktreePath,
    systemPromptFilePath,
    promptDir,
    maxBudgetUsd = DEFAULT_PLAN_REVIEW_BUDGET_USD,
  } = context;
  return async function generateProposal(strategy, issue) {
    const promptFilePath = writeTextFile(
      join(promptDir, `proposal-${strategy}.txt`),
      [
        `You are proposing a solution using the "${strategy}" strategy for the following issue.`,
        "",
        `Issue #${issue.number}: ${issue.title}`,
        "",
        issue.body ?? "",
        "",
        'Respond with exactly one JSON object matching this shape: {"summary": "<your proposed solution, 2-4 paragraphs>", "declaredPaths": [<every file or directory path, relative to the repo root, that you expect this solution to touch>]}. No other text.',
      ].join("\n"),
    );
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath,
      role: "plan",
      systemPromptFilePath,
      maxBudgetUsd,
      promptFilePath,
      jsonSchema: PROPOSAL_SCHEMA,
    });
    const result = await invoke({
      composeArgs,
      claudeArgs,
      promptFilePath,
      cwd: worktreePath,
    });
    return parseStructuredResponse(result);
  };
}

// tier-resolution.mjs's resolveTier() calls this once per issue, before tier is
// known -- so there is no PANEL_COMPOSITION strategy name to use yet. "scoping" is
// a fixed, dedicated strategy name for this one preliminary call, distinct from
// any of review-panel.mjs's real proposalStrategies.
export function buildRealGenerateScopingProposal(
  context,
  { invoke = invokeAgent } = {},
) {
  const {
    worktreePath,
    systemPromptFilePath,
    promptDir,
    maxBudgetUsd = DEFAULT_PLAN_REVIEW_BUDGET_USD,
  } = context;
  return async function generateScopingProposal(issue) {
    const promptFilePath = writeTextFile(
      join(promptDir, "proposal-scoping.txt"),
      [
        "You are scoping a proposed fix for the following issue before any implementation work happens.",
        "Estimate its real shape honestly -- this estimate decides how much review scrutiny the work gets.",
        "",
        `Issue #${issue.number}: ${issue.title}`,
        "",
        issue.body ?? "",
        "",
        "Respond with exactly one JSON object with these fields:",
        '{"summary": "<2-4 sentence outline of the fix>",',
        ' "estimatedLines": <your best estimate of total changed lines, an integer>,',
        ' "moduleCount": <how many distinct modules/packages this touches, an integer>,',
        ' "isDocsOrConfigOnly": <true only if this is purely docs, comments, or config text, no logic change>,',
        ' "touchesSensitiveArea": <true if this touches auth, secrets, CI config, migrations, or a public API contract>,',
        ' "riskTier": "<L0, L1, L2, or L3, the org\'s standard risk scale>",',
        ' "declaredActionTypes": [<any of "prod-deploy", "data-deletion", "permission-change", "secret-change", "prod-sql" that genuinely apply, otherwise an empty array>],',
        ' "suggestedTier": "<lite, standard, or high-risk -- your own opinion of the right review tier, or null if you have no opinion beyond the facts above>",',
        ' "confidence": <your confidence in this whole assessment, 0.0 to 1.0>,',
        ' "reviewerStatedUncertain": <true if you genuinely cannot assess this with the information given>,',
        ' "acceptanceCriteriaCrowdDerived": <true only if the issue body itself does not state clear acceptance criteria and you would have to infer them from comment discussion instead -- false if the issue body alone already states what "done" means>}',
        "No other text.",
      ].join("\n"),
    );
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath,
      role: "plan",
      systemPromptFilePath,
      maxBudgetUsd,
      promptFilePath,
      jsonSchema: SCOPING_SCHEMA,
    });
    const result = await invoke({
      composeArgs,
      claudeArgs,
      promptFilePath,
      cwd: worktreePath,
    });
    return parseStructuredResponse(result);
  };
}

// implement-review.mjs's runStep3() implement() callback. role "implement" gets
// Bash (roleNeedsBash), scoped to exactly allowedToolCommands -- there is no
// default allowlist here; a caller that omits it gets invoker.mjs's own
// "--allowedTools" with nothing after it, which is a caller bug this function
// does not paper over by guessing a list. implement only writes files; it does
// not commit -- commitAndPush (step 4) is the single place a commit happens,
// per git-ops.mjs's own design note.
export function buildRealImplement(context, { invoke = invokeAgent } = {}) {
  const {
    worktreePath,
    systemPromptFilePath,
    promptDir,
    allowedToolCommands,
    maxBudgetUsd = DEFAULT_IMPLEMENT_FIX_BUDGET_USD,
  } = context;
  return async function implement(winningProposal, issue) {
    const promptFilePath = writeTextFile(
      join(promptDir, "implement.txt"),
      [
        `Implement the following solution for issue #${issue.number}: ${issue.title}, in the current working directory.`,
        "Write and edit the files the solution needs. Do not run any git commit or git push -- committing happens separately, later.",
        "",
        "Issue body:",
        issue.body ?? "",
        "",
        "Solution to implement:",
        winningProposal.summary,
      ].join("\n"),
    );
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath,
      role: "implement",
      systemPromptFilePath,
      allowedToolCommands,
      maxBudgetUsd,
      promptFilePath,
    });
    const result = await invoke({
      composeArgs,
      claudeArgs,
      promptFilePath,
      cwd: worktreePath,
    });
    return assertInvokeSucceeded(result);
  };
}

// implement-review.mjs's runStep3() fix() callback. Same role/allowlist shape as
// implement -- a fix is just more editing in the same worktree, never a commit.
// failureDescription is whatever runStep3 passed: either {reason:
// "local-gate-failure", gateResult} or {reason: "review-must-fix",
// mustFixItems}; runCiRetryLoop's attemptFix(attempt) (step 4, PR-F8-6) is
// expected to wrap this same function with its own CI-failure description, not
// a separate carrier callback.
function formatFailureDescription(failureDescription) {
  if (failureDescription.reason === "local-gate-failure") {
    const failed = failureDescription.gateResult.results.filter((r) => !r.pass);
    return failed
      .map((r) => `Command failed: ${r.command}\nOutput:\n${r.output}`)
      .join("\n\n");
  }
  if (failureDescription.reason === "review-must-fix") {
    return failureDescription.mustFixItems
      .map((item) => `- ${item}`)
      .join("\n");
  }
  // step 4's attemptCiFix (PR-F8-6): CI failed after the PR was opened. The
  // caller is responsible for pre-filtering failingChecks to the non-green
  // ones before constructing this object (same contract as review-must-fix's
  // mustFixItems above) -- this function does not re-filter by conclusion
  // itself. This is the most actionable detail available without fetching
  // full job logs (not done here, same scope boundary as pollChecks/G2's own
  // check-name-level granularity).
  if (failureDescription.reason === "ci-failure") {
    return failureDescription.failingChecks
      .map(
        (c) => `CI check failed: ${c.name} (${c.conclusion ?? "not settled"})`,
      )
      .join("\n");
  }
  return JSON.stringify(failureDescription);
}

export function buildRealFix(context, { invoke = invokeAgent } = {}) {
  const {
    worktreePath,
    systemPromptFilePath,
    promptDir,
    allowedToolCommands,
    maxBudgetUsd = DEFAULT_IMPLEMENT_FIX_BUDGET_USD,
  } = context;
  return async function fix(failureDescription, issue) {
    const promptFilePath = writeTextFile(
      join(promptDir, `fix-${Date.now()}.txt`),
      [
        `Issue #${issue.number}: ${issue.title}. Your previous implementation in this working directory has a problem. Fix it in place. Do not run any git commit or git push.`,
        "",
        `Reason: ${failureDescription.reason}`,
        "",
        formatFailureDescription(failureDescription),
      ].join("\n"),
    );
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath,
      role: "fix",
      systemPromptFilePath,
      allowedToolCommands,
      maxBudgetUsd,
      promptFilePath,
    });
    const result = await invoke({
      composeArgs,
      claudeArgs,
      promptFilePath,
      cwd: worktreePath,
    });
    return assertInvokeSucceeded(result);
  };
}

// implement-review.mjs's runStep3() review() callback -- reviews the actual
// diff produced by implement/fix, not a written proposal (that is step 2's
// buildRealReviewProposal, a different schema and a different call site). The
// diff is computed here (git diff HEAD, i.e. everything implement/fix changed
// since the worktree was created) and embedded as prompt text, so this role can
// stay Bash-free like step 2's review -- it judges text, it does not explore
// the filesystem itself.
export function buildRealReviewImplementation(
  context,
  {
    invoke = invokeAgent,
    computeWorkingTreeDiff = defaultComputeWorkingTreeDiff,
  } = {},
) {
  const {
    worktreePath,
    systemPromptFilePath,
    promptDir,
    maxBudgetUsd = DEFAULT_PLAN_REVIEW_BUDGET_USD,
  } = context;
  return async function review(perspective, issue) {
    const diff = computeWorkingTreeDiff(worktreePath);
    const promptFilePath = writeTextFile(
      join(promptDir, `impl-review-${perspective}-${Date.now()}.txt`),
      [
        `You are reviewing an implementation from the "${perspective}" perspective, for the following issue.`,
        "",
        `Issue #${issue.number}: ${issue.title}`,
        "",
        issue.body ?? "",
        "",
        "Diff to review:",
        diff,
        "",
        'Respond with exactly one JSON object matching this shape: {"mustFixItems": [<strings, empty array if nothing must be fixed>]}. No other text.',
      ].join("\n"),
    );
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath,
      role: "review",
      systemPromptFilePath,
      maxBudgetUsd,
      promptFilePath,
      jsonSchema: IMPLEMENT_REVIEW_SCHEMA,
    });
    const result = await invoke({
      composeArgs,
      claudeArgs,
      promptFilePath,
      cwd: worktreePath,
    });
    return parseStructuredResponse(result);
  };
}

export function buildRealReviewProposal(
  context,
  { invoke = invokeAgent } = {},
) {
  const {
    worktreePath,
    systemPromptFilePath,
    promptDir,
    maxBudgetUsd = DEFAULT_PLAN_REVIEW_BUDGET_USD,
  } = context;
  return async function reviewProposal(perspective, proposal) {
    const promptFilePath = writeTextFile(
      join(promptDir, `review-${perspective}-${proposal.id}.txt`),
      [
        `You are reviewing a proposed solution from the "${perspective}" perspective.`,
        "",
        `Strategy: ${proposal.strategy}`,
        "",
        proposal.summary,
        "",
        'Respond with exactly one JSON object matching this shape: {"score": <integer 0-10>, "mustFix": [<strings, empty array if none>]}. No other text.',
      ].join("\n"),
    );
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath,
      role: "review",
      systemPromptFilePath,
      maxBudgetUsd,
      promptFilePath,
      jsonSchema: REVIEW_SCHEMA,
    });
    const result = await invoke({
      composeArgs,
      claudeArgs,
      promptFilePath,
      cwd: worktreePath,
    });
    return parseStructuredResponse(result);
  };
}

// local-service.mjs's generateVerifyChecklist() calls this once per merged
// issue, after step 5's shared verification worktree (the current default
// branch, every issue already merged in) is up. Bash-free "plan" role, same as
// the other judgment-only calls -- turning acceptance criteria already in the
// issue body into checklist items needs no code exploration.
export function buildRealSummarizeAcceptanceCriteria(
  context,
  { invoke = invokeAgent } = {},
) {
  const {
    worktreePath,
    systemPromptFilePath,
    promptDir,
    maxBudgetUsd = DEFAULT_PLAN_REVIEW_BUDGET_USD,
  } = context;
  return async function summarizeAcceptanceCriteria(issue) {
    const promptFilePath = writeTextFile(
      join(promptDir, `verify-checklist-${issue.number}.txt`),
      [
        `Issue #${issue.number}: ${issue.title} has been implemented and merged.`,
        "Turn its acceptance criteria into a short list of concrete, manually-checkable items a human can tick off while verifying the live result.",
        "",
        "Issue body:",
        issue.body ?? "",
        "",
        'Respond with exactly one JSON object matching this shape: {"checklistItems": [<short imperative strings, e.g. "Log in and confirm the new field appears">]}. No other text.',
      ].join("\n"),
    );
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath,
      role: "plan",
      systemPromptFilePath,
      maxBudgetUsd,
      promptFilePath,
      jsonSchema: ACCEPTANCE_CRITERIA_SCHEMA,
    });
    const result = await invoke({
      composeArgs,
      claudeArgs,
      promptFilePath,
      cwd: worktreePath,
    });
    const { checklistItems } = parseStructuredResponse(result);
    return checklistItems;
  };
}

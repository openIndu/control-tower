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

const PROPOSAL_SCHEMA = {
  type: "object",
  properties: { summary: { type: "string" } },
  required: ["summary"],
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    mustFix: { type: "array", items: { type: "string" } },
  },
  required: ["score"],
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
  return JSON.parse(invokeResult.text);
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
        'Respond with exactly one JSON object matching this shape: {"summary": "<your proposed solution, 2-4 paragraphs>"}. No other text.',
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
        ' "reviewerStatedUncertain": <true if you genuinely cannot assess this with the information given>}',
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

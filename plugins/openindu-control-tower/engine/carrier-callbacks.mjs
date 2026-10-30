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

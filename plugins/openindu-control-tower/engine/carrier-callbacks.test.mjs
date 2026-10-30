import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildRealGenerateProposal,
  buildRealGenerateScopingProposal,
  buildRealReviewProposal,
  buildSystemPromptText,
  DEFAULT_PLAN_REVIEW_BUDGET_USD,
} from "./carrier-callbacks.mjs";

test("buildSystemPromptText includes the Rule #1 anchor and the given principle/repo text", () => {
  const text = buildSystemPromptText({
    principleText: "PRINCIPLE-BODY",
    repoClaudeMd: "CLAUDE-MD-BODY",
    repoAgentsMd: null,
  });
  assert.match(text, /load and follow the openIndu agent principles/);
  assert.match(text, /PRINCIPLE-BODY/);
  assert.match(text, /CLAUDE-MD-BODY/);
});

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "carrier-callbacks-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("buildRealGenerateProposal writes a real prompt file naming the strategy and issue, then returns the parsed summary", async () => {
  await withTempDir(async (dir) => {
    let seenArgs = null;
    const generateProposal = buildRealGenerateProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/system-prompt.txt",
        promptDir: dir,
      },
      {
        invoke: async (args) => {
          seenArgs = args;
          return {
            success: true,
            text: JSON.stringify({ summary: "do the simple thing" }),
          };
        },
      },
    );
    const result = await generateProposal("minimal-diff", {
      number: 42,
      title: "Fix the thing",
      body: "details",
    });
    assert.deepEqual(result, { summary: "do the simple thing" });

    const promptFilePath = join(dir, "proposal-minimal-diff.txt");
    assert.equal(existsSync(promptFilePath), true);
    const promptText = readFileSync(promptFilePath, "utf8");
    assert.match(promptText, /minimal-diff/);
    assert.match(promptText, /Issue #42: Fix the thing/);
    assert.match(promptText, /details/);

    assert.equal(seenArgs.cwd, "/wt");
    assert.equal(seenArgs.promptFilePath, promptFilePath);
    assert.deepEqual(seenArgs.composeArgs, [
      "run",
      "--rm",
      "-v",
      "/wt:/workspace",
      "agent",
    ]);
    assert.ok(seenArgs.claudeArgs.includes("--json-schema"));
    assert.ok(
      !seenArgs.claudeArgs.includes("--tools"),
      "plan role must not get Bash",
    );
    const budgetIndex = seenArgs.claudeArgs.indexOf("--max-budget-usd");
    assert.equal(
      seenArgs.claudeArgs[budgetIndex + 1],
      String(DEFAULT_PLAN_REVIEW_BUDGET_USD),
    );
  });
});

test("buildRealGenerateProposal honors an overridden maxBudgetUsd", async () => {
  await withTempDir(async (dir) => {
    let seenArgs = null;
    const generateProposal = buildRealGenerateProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
        maxBudgetUsd: 2.5,
      },
      {
        invoke: async (args) => {
          seenArgs = args;
          return { success: true, text: '{"summary":"x"}' };
        },
      },
    );
    await generateProposal("strategy-a", { number: 1, title: "t", body: "b" });
    const budgetIndex = seenArgs.claudeArgs.indexOf("--max-budget-usd");
    assert.equal(seenArgs.claudeArgs[budgetIndex + 1], "2.5");
  });
});

test("buildRealReviewProposal writes a real prompt file naming the perspective and proposal id, requests Bash-free review role, and returns the parsed score", async () => {
  await withTempDir(async (dir) => {
    let seenArgs = null;
    const reviewProposal = buildRealReviewProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      {
        invoke: async (args) => {
          seenArgs = args;
          return {
            success: true,
            text: JSON.stringify({ score: 8, mustFix: [] }),
          };
        },
      },
    );
    const result = await reviewProposal("security", {
      id: "p1",
      strategy: "minimal-diff",
      summary: "do X",
    });
    assert.deepEqual(result, { score: 8, mustFix: [] });

    const promptFilePath = join(dir, "review-security-p1.txt");
    assert.equal(existsSync(promptFilePath), true);
    assert.match(readFileSync(promptFilePath, "utf8"), /security/);
    assert.ok(
      !seenArgs.claudeArgs.includes("--tools"),
      "review role must not get Bash",
    );
  });
});

test("buildRealGenerateProposal throws when the carrier invocation did not succeed", async () => {
  await withTempDir(async (dir) => {
    const generateProposal = buildRealGenerateProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      {
        invoke: async () => ({
          success: false,
          subtype: "budget_exhausted",
          errors: ["over budget"],
        }),
      },
    );
    await assert.rejects(
      () => generateProposal("x", { number: 1, title: "t", body: "b" }),
      /budget_exhausted/,
    );
  });
});

test("buildRealReviewProposal throws when the carrier invocation returns no text", async () => {
  await withTempDir(async (dir) => {
    const reviewProposal = buildRealReviewProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      { invoke: async () => ({ success: true, text: null }) },
    );
    await assert.rejects(
      () =>
        reviewProposal("security", { id: "p1", strategy: "x", summary: "y" }),
      /no text to parse/,
    );
  });
});

test("buildRealGenerateScopingProposal writes a dedicated scoping prompt, requests a Bash-free plan role, and returns the full self-declared scope", async () => {
  await withTempDir(async (dir) => {
    let seenArgs = null;
    const scopingFacts = {
      summary: "small docs fix",
      estimatedLines: 5,
      moduleCount: 1,
      isDocsOrConfigOnly: true,
      touchesSensitiveArea: false,
      riskTier: "L0",
      declaredActionTypes: [],
      suggestedTier: null,
      confidence: 0.95,
      reviewerStatedUncertain: false,
    };
    const generateScopingProposal = buildRealGenerateScopingProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      {
        invoke: async (args) => {
          seenArgs = args;
          return { success: true, text: JSON.stringify(scopingFacts) };
        },
      },
    );
    const result = await generateScopingProposal({
      number: 7,
      title: "Fix typo",
      body: "in the README",
    });
    assert.deepEqual(result, scopingFacts);

    const promptFilePath = join(dir, "proposal-scoping.txt");
    assert.equal(existsSync(promptFilePath), true);
    assert.match(readFileSync(promptFilePath, "utf8"), /Issue #7: Fix typo/);
    assert.ok(
      !seenArgs.claudeArgs.includes("--tools"),
      "scoping call must not get Bash",
    );
    assert.ok(seenArgs.claudeArgs.includes("--json-schema"));
  });
});

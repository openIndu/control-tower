import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildRealFix,
  buildRealGenerateProposal,
  buildRealGenerateScopingProposal,
  buildRealImplement,
  buildRealReviewImplementation,
  buildRealReviewProposal,
  buildRealSummarizeAcceptanceCriteria,
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
      "-e",
      "ANTHROPIC_API_KEY",
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

test("buildRealGenerateProposal propagates the invocation's actual costUsd alongside the parsed summary, for the runner's total-budget tracking", async () => {
  await withTempDir(async (dir) => {
    const generateProposal = buildRealGenerateProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      {
        invoke: async () => ({
          success: true,
          text: JSON.stringify({ summary: "x" }),
          costUsd: 0.1234,
        }),
      },
    );
    const result = await generateProposal("x", {
      number: 1,
      title: "t",
      body: "b",
    });
    assert.deepEqual(result, { summary: "x", costUsd: 0.1234 });
  });
});

test("buildRealGenerateProposal's prompt asks for declaredPaths, and propagates whatever the carrier returns for it (guardG4's scope-boundary input)", async () => {
  await withTempDir(async (dir) => {
    const generateProposal = buildRealGenerateProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/system-prompt.txt",
        promptDir: dir,
      },
      {
        invoke: async () => ({
          success: true,
          text: JSON.stringify({
            summary: "x",
            declaredPaths: ["src/foo.ts", "src/foo.test.ts"],
          }),
        }),
      },
    );
    const result = await generateProposal("x", {
      number: 1,
      title: "t",
      body: "b",
    });
    assert.deepEqual(result, {
      summary: "x",
      declaredPaths: ["src/foo.ts", "src/foo.test.ts"],
    });
    const promptText = readFileSync(join(dir, "proposal-x.txt"), "utf8");
    assert.match(promptText, /declaredPaths/);
  });
});

test("buildRealGenerateProposal propagates rawStdout alongside costUsd and the parsed summary, for trace-log.mjs", async () => {
  await withTempDir(async (dir) => {
    const generateProposal = buildRealGenerateProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      {
        invoke: async () => ({
          success: true,
          text: JSON.stringify({ summary: "x" }),
          costUsd: 0.1234,
          rawStdout: "raw trace text",
        }),
      },
    );
    const result = await generateProposal("x", {
      number: 1,
      title: "t",
      body: "b",
    });
    assert.deepEqual(result, {
      summary: "x",
      costUsd: 0.1234,
      rawStdout: "raw trace text",
    });
  });
});

test("buildRealGenerateScopingProposal propagates costUsd:null unchanged (invokeAgent's own fallback when the carrier reports no cost)", async () => {
  await withTempDir(async (dir) => {
    const generateScopingProposal = buildRealGenerateScopingProposal(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      {
        invoke: async () => ({
          success: true,
          text: JSON.stringify({
            summary: "s",
            estimatedLines: 1,
            moduleCount: 1,
            isDocsOrConfigOnly: true,
            touchesSensitiveArea: false,
            riskTier: "L0",
            declaredActionTypes: [],
            suggestedTier: null,
            confidence: 0.9,
            reviewerStatedUncertain: false,
          }),
          costUsd: null,
        }),
      },
    );
    const result = await generateScopingProposal({
      number: 1,
      title: "t",
      body: "b",
    });
    assert.equal(result.costUsd, null);
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
      acceptanceCriteriaCrowdDerived: false,
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
    assert.match(
      readFileSync(promptFilePath, "utf8"),
      /acceptanceCriteriaCrowdDerived/,
    );
    assert.ok(
      !seenArgs.claudeArgs.includes("--tools"),
      "scoping call must not get Bash",
    );
    assert.ok(seenArgs.claudeArgs.includes("--json-schema"));
  });
});

test("buildRealImplement writes a prompt naming the issue and the winning proposal, requests the implement role with the given allowlist, and does not ask for a commit", async () => {
  await withTempDir(async (dir) => {
    let seenArgs = null;
    const implement = buildRealImplement(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
        allowedToolCommands: ["npm test", "npm run lint"],
      },
      {
        invoke: async (args) => {
          seenArgs = args;
          return { success: true, text: null };
        },
      },
    );
    await implement(
      { summary: "Add a null check in parseThing" },
      { number: 9, title: "Crash on empty input", body: "it throws" },
    );
    const promptFilePath = join(dir, "implement.txt");
    assert.equal(existsSync(promptFilePath), true);
    const text = readFileSync(promptFilePath, "utf8");
    assert.match(text, /issue #9: Crash on empty input/);
    assert.match(text, /Add a null check in parseThing/);
    assert.match(text, /Do not run any git commit/);
    assert.ok(seenArgs.claudeArgs.includes("--tools"));
    assert.ok(seenArgs.claudeArgs.includes("npm test"));
    assert.ok(seenArgs.claudeArgs.includes("npm run lint"));
  });
});

test("buildRealImplement throws when the carrier invocation does not succeed", async () => {
  await withTempDir(async (dir) => {
    const implement = buildRealImplement(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
        allowedToolCommands: [],
      },
      {
        invoke: async () => ({
          success: false,
          subtype: "error",
          errors: ["boom"],
        }),
      },
    );
    await assert.rejects(
      () => implement({ summary: "x" }, { number: 1, title: "t", body: "b" }),
      /did not succeed/,
    );
  });
});

test("buildRealFix (local-gate-failure) includes only the failing command's output in the prompt", async () => {
  await withTempDir(async (dir) => {
    let capturedPromptFile = null;
    const fix = buildRealFix(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
        allowedToolCommands: ["npm test"],
      },
      {
        invoke: async (args) => {
          capturedPromptFile = args.promptFilePath;
          return { success: true, text: null };
        },
      },
    );
    await fix(
      {
        reason: "local-gate-failure",
        gateResult: {
          pass: false,
          results: [
            { command: "npm test", pass: false, output: "1 failing" },
            { command: "npm run lint", pass: true, output: "lint clean" },
          ],
        },
      },
      { number: 3, title: "Flaky", body: "b" },
    );
    const text = readFileSync(capturedPromptFile, "utf8");
    assert.match(text, /npm test/);
    assert.match(text, /1 failing/);
    assert.ok(
      !text.includes("lint clean"),
      "a passing gate's output must not be included",
    );
  });
});

test("buildRealFix (review-must-fix) lists every must-fix item in the prompt", async () => {
  await withTempDir(async (dir) => {
    let capturedPromptFile = null;
    const fix = buildRealFix(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
        allowedToolCommands: [],
      },
      {
        invoke: async (args) => {
          capturedPromptFile = args.promptFilePath;
          return { success: true, text: null };
        },
      },
    );
    await fix(
      {
        reason: "review-must-fix",
        mustFixItems: ["handle the null case", "add a test"],
      },
      { number: 3, title: "t", body: "b" },
    );
    const text = readFileSync(capturedPromptFile, "utf8");
    assert.match(text, /handle the null case/);
    assert.match(text, /add a test/);
  });
});

test("buildRealFix (ci-failure) names the failing checks given to it (the caller is responsible for pre-filtering to non-green ones)", async () => {
  await withTempDir(async (dir) => {
    let capturedPromptFile = null;
    const fix = buildRealFix(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
        allowedToolCommands: ["npm test"],
      },
      {
        invoke: async (args) => {
          capturedPromptFile = args.promptFilePath;
          return { success: true, text: null };
        },
      },
    );
    await fix(
      {
        reason: "ci-failure",
        attempt: 1,
        failingChecks: [{ name: "unit-tests", conclusion: "FAILURE" }],
      },
      { number: 3, title: "t", body: "b" },
    );
    const text = readFileSync(capturedPromptFile, "utf8");
    assert.match(text, /unit-tests/);
    assert.match(text, /FAILURE/);
  });
});

test("buildRealReviewImplementation computes the working-tree diff, embeds it, and requests a Bash-free review role", async () => {
  await withTempDir(async (dir) => {
    let seenArgs = null;
    const review = buildRealReviewImplementation(
      {
        worktreePath: "/wt",
        systemPromptFilePath: "/wt/sp.txt",
        promptDir: dir,
      },
      {
        computeWorkingTreeDiff: () => "diff --git a/x.js b/x.js\n+added line",
        invoke: async (args) => {
          seenArgs = args;
          return {
            success: true,
            text: JSON.stringify({ mustFixItems: ["fix x"] }),
          };
        },
      },
    );
    const result = await review("security", {
      number: 5,
      title: "t",
      body: "b",
    });
    assert.deepEqual(result, { mustFixItems: ["fix x"] });
    const text = readFileSync(seenArgs.promptFilePath, "utf8");
    assert.match(text, /added line/);
    assert.ok(
      !seenArgs.claudeArgs.includes("--tools"),
      "implementation review must not get Bash",
    );
    assert.ok(seenArgs.claudeArgs.includes("--json-schema"));
  });
});

test("buildRealSummarizeAcceptanceCriteria writes a per-issue checklist prompt, requests a Bash-free plan role, and returns the checklist items unwrapped", async () => {
  await withTempDir(async (dir) => {
    let seenArgs = null;
    const summarize = buildRealSummarizeAcceptanceCriteria(
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
            text: JSON.stringify({
              checklistItems: ["Log in", "Check the new field"],
            }),
          };
        },
      },
    );
    const result = await summarize({
      number: 11,
      title: "Add profile field",
      body: "Users can set a bio.",
    });
    assert.deepEqual(result, ["Log in", "Check the new field"]);
    const promptFilePath = join(dir, "verify-checklist-11.txt");
    assert.equal(existsSync(promptFilePath), true);
    assert.match(
      readFileSync(promptFilePath, "utf8"),
      /Issue #11: Add profile field/,
    );
    assert.ok(
      !seenArgs.claudeArgs.includes("--tools"),
      "verify-checklist call must not get Bash",
    );
  });
});

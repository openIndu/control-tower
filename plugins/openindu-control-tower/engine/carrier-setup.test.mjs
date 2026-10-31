import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildCarrierCallbacks,
  setupSystemPrompt,
  withTrackingWrappers,
} from "./carrier-setup.mjs";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "carrier-setup-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("setupSystemPrompt reads the principle, repo CLAUDE.md and AGENTS.md, writes one combined file, and returns its path", () => {
  withTempDir((root) => {
    const controlTowerRepoPath = join(root, "ct");
    const repoClonePath = join(root, "target-repo");
    mkdirSync(
      join(
        controlTowerRepoPath,
        "plugins/openindu-control-tower/skills/principle",
      ),
      { recursive: true },
    );
    writeFileSync(
      join(
        controlTowerRepoPath,
        "plugins/openindu-control-tower/skills/principle/SKILL.md",
      ),
      "THE PRINCIPLE TEXT",
    );
    mkdirSync(repoClonePath, { recursive: true });
    writeFileSync(join(repoClonePath, "CLAUDE.md"), "REPO CLAUDE TEXT");
    writeFileSync(join(repoClonePath, "AGENTS.md"), "REPO AGENTS TEXT");
    const promptDir = join(root, "prompts");

    const path = setupSystemPrompt({
      controlTowerRepoPath,
      repoClonePath,
      promptDir,
    });

    assert.ok(existsSync(path));
    const text = readFileSync(path, "utf8");
    assert.match(text, /THE PRINCIPLE TEXT/);
    assert.match(text, /REPO CLAUDE TEXT/);
    assert.match(text, /REPO AGENTS TEXT/);
  });
});

test("setupSystemPrompt tolerates a repo with no CLAUDE.md or AGENTS.md at all", () => {
  withTempDir((root) => {
    const controlTowerRepoPath = join(root, "ct");
    const repoClonePath = join(root, "target-repo");
    mkdirSync(
      join(
        controlTowerRepoPath,
        "plugins/openindu-control-tower/skills/principle",
      ),
      { recursive: true },
    );
    writeFileSync(
      join(
        controlTowerRepoPath,
        "plugins/openindu-control-tower/skills/principle/SKILL.md",
      ),
      "THE PRINCIPLE TEXT",
    );
    mkdirSync(repoClonePath, { recursive: true });
    const promptDir = join(root, "prompts");

    const path = setupSystemPrompt({
      controlTowerRepoPath,
      repoClonePath,
      promptDir,
    });

    assert.match(readFileSync(path, "utf8"), /THE PRINCIPLE TEXT/);
  });
});

test("setupSystemPrompt throws rather than silently proceeding when the principle SKILL.md cannot be read (RULE 1)", () => {
  withTempDir((root) => {
    assert.throws(
      () =>
        setupSystemPrompt({
          controlTowerRepoPath: join(root, "nonexistent-ct"),
          repoClonePath: join(root, "nonexistent-repo"),
          promptDir: join(root, "prompts"),
        }),
      /RULE 1/,
    );
  });
});

test("buildCarrierCallbacks returns all 6 real callbacks, each wired to the same shared context", async () => {
  await withTempDir(async (promptDir) => {
    const seenPromptFiles = [];
    const context = {
      worktreePath: "/wt",
      systemPromptFilePath: "/wt/sp.txt",
      promptDir,
      allowedToolCommands: ["npm test"],
      maxBudgetUsd: 5,
    };
    const callbacks = buildCarrierCallbacks(context, {
      invoke: async (args) => {
        seenPromptFiles.push(args.promptFilePath);
        return { success: true, text: "{}" };
      },
    });

    assert.deepEqual(Object.keys(callbacks).sort(), [
      "fix",
      "generateProposal",
      "generateScopingProposal",
      "implement",
      "reviewImplementation",
      "reviewProposal",
    ]);

    await callbacks.generateScopingProposal({
      number: 1,
      title: "t",
      body: "b",
    });
    assert.ok(seenPromptFiles[0].startsWith(promptDir));
  });
});

test("withTrackingWrappers wraps every callback, passing cost to addCost, a trace entry labeled by the callback's own key to appendTrace, and the result through unchanged", async () => {
  let totalCost = 0;
  const traceEntries = [];
  const callbacks = {
    generateProposal: async () => ({
      summary: "s",
      costUsd: 0.5,
      rawStdout: "proposal stdout",
    }),
    implement: async () => ({
      filesChanged: ["a.js"],
      costUsd: 1.5,
      rawStdout: "implement stdout",
    }),
  };

  const wrapped = withTrackingWrappers(callbacks, {
    addCost: (cost) => {
      totalCost += cost;
    },
    appendTrace: (entry) => traceEntries.push(entry),
  });

  const proposalResult = await wrapped.generateProposal();
  const implementResult = await wrapped.implement();

  assert.equal(totalCost, 2);
  assert.deepEqual(proposalResult, {
    summary: "s",
    costUsd: 0.5,
    rawStdout: "proposal stdout",
  });
  assert.deepEqual(implementResult, {
    filesChanged: ["a.js"],
    costUsd: 1.5,
    rawStdout: "implement stdout",
  });
  assert.deepEqual(traceEntries, [
    { label: "generateProposal", rawStdout: "proposal stdout" },
    { label: "implement", rawStdout: "implement stdout" },
  ]);
});

test("withTrackingWrappers tolerates a bare fake callback with no costUsd/rawStdout -- neither wrapper throws, and nothing gets tracked", async () => {
  let addCostCalled = false;
  let appendTraceCalled = false;
  const wrapped = withTrackingWrappers(
    { reviewProposal: async () => ({ score: 7, mustFix: [] }) },
    {
      addCost: () => {
        addCostCalled = true;
      },
      appendTrace: () => {
        appendTraceCalled = true;
      },
    },
  );

  const result = await wrapped.reviewProposal();

  assert.deepEqual(result, { score: 7, mustFix: [] });
  assert.equal(addCostCalled, false);
  assert.equal(appendTraceCalled, false);
});

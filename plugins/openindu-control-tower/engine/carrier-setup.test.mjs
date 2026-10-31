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

import { buildCarrierCallbacks, setupSystemPrompt } from "./carrier-setup.mjs";

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

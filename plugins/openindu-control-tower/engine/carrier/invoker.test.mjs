import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAppendSystemPrompt,
  buildDockerComposeRunArgs,
  CREDENTIAL_ENV_VAR_NAMES,
  detectCredentialEnvVar,
  roleNeedsBash,
} from "./invoker.mjs";

test("plan and review roles never get Bash", () => {
  assert.equal(roleNeedsBash("plan"), false);
  assert.equal(roleNeedsBash("review"), false);
});
test("implement and fix roles get Bash", () => {
  assert.equal(roleNeedsBash("implement"), true);
  assert.equal(roleNeedsBash("fix"), true);
});
test("an unknown role is rejected rather than silently defaulting either way", () =>
  assert.throws(() => roleNeedsBash("mystery"), /Unknown agent role/));

test("buildAppendSystemPrompt always includes Rule #1 and the principle text", () => {
  const prompt = buildAppendSystemPrompt({
    rule1AnchorText: "RULE1",
    principleText: "PRINCIPLE",
    repoClaudeMd: null,
    repoAgentsMd: null,
  });
  assert.ok(prompt.includes("RULE1"));
  assert.ok(prompt.includes("PRINCIPLE"));
});
test("buildAppendSystemPrompt includes the target repo's own CLAUDE.md/AGENTS.md when present", () => {
  const prompt = buildAppendSystemPrompt({
    rule1AnchorText: "RULE1",
    principleText: "PRINCIPLE",
    repoClaudeMd: "REPO-CLAUDE",
    repoAgentsMd: "REPO-AGENTS",
  });
  assert.ok(prompt.includes("REPO-CLAUDE"));
  assert.ok(prompt.includes("REPO-AGENTS"));
});
test("buildAppendSystemPrompt works with neither CLAUDE.md nor AGENTS.md present (e.g. studio)", () => {
  const prompt = buildAppendSystemPrompt({
    rule1AnchorText: "RULE1",
    principleText: "PRINCIPLE",
    repoClaudeMd: null,
    repoAgentsMd: null,
  });
  assert.equal(prompt, "RULE1\n\n---\n\nPRINCIPLE");
});

test("buildDockerComposeRunArgs mounts only the worktree, nothing else", () => {
  const { composeArgs } = buildDockerComposeRunArgs({
    worktreePath: "/tmp/worktree",
    role: "plan",
    systemPromptFilePath: "/tmp/prompt.txt",
    maxBudgetUsd: 1,
    promptFilePath: "/tmp/issue.txt",
  });
  assert.deepEqual(composeArgs, [
    "run",
    "--rm",
    "-v",
    "/tmp/worktree:/workspace",
    "-e",
    "ANTHROPIC_API_KEY",
    "agent",
  ]);
});

test("buildDockerComposeRunArgs always forwards ANTHROPIC_API_KEY by bare name, never embedding its actual value", () => {
  const { composeArgs } = buildDockerComposeRunArgs({
    worktreePath: "/tmp/worktree",
    role: "implement",
    systemPromptFilePath: "/tmp/prompt.txt",
    allowedToolCommands: ["Bash(npm test)"],
    maxBudgetUsd: 2,
    promptFilePath: "/tmp/issue.txt",
  });
  const flagIndex = composeArgs.indexOf("-e");
  assert.ok(flagIndex >= 0, "expected a bare -e flag in composeArgs");
  assert.equal(composeArgs[flagIndex + 1], "ANTHROPIC_API_KEY");
  assert.ok(
    composeArgs.indexOf("agent") > flagIndex,
    "-e ANTHROPIC_API_KEY must come before the service name per docker compose's own argv order",
  );
});
test("buildDockerComposeRunArgs always includes --restricted and --strict-mcp-config", () => {
  const { claudeArgs } = buildDockerComposeRunArgs({
    worktreePath: "/tmp/worktree",
    role: "plan",
    systemPromptFilePath: "/tmp/prompt.txt",
    maxBudgetUsd: 1,
    promptFilePath: "/tmp/issue.txt",
  });
  assert.ok(claudeArgs.includes("--restricted"));
  assert.ok(claudeArgs.includes("--strict-mcp-config"));
  assert.ok(!claudeArgs.includes("--tools"));
});
test("buildDockerComposeRunArgs gives implement/fix roles --tools Bash scoped to allowedToolCommands", () => {
  const { claudeArgs } = buildDockerComposeRunArgs({
    worktreePath: "/tmp/worktree",
    role: "implement",
    systemPromptFilePath: "/tmp/prompt.txt",
    allowedToolCommands: ["Bash(npm test)", "Bash(npm run lint)"],
    maxBudgetUsd: 2,
    promptFilePath: "/tmp/issue.txt",
  });
  const toolsIndex = claudeArgs.indexOf("--tools");
  assert.equal(claudeArgs[toolsIndex + 1], "Bash");
  const allowedIndex = claudeArgs.indexOf("--allowedTools");
  assert.deepEqual(claudeArgs.slice(allowedIndex + 1, allowedIndex + 3), [
    "Bash(npm test)",
    "Bash(npm run lint)",
  ]);
});
test("buildDockerComposeRunArgs never puts the prompt text itself into claudeArgs", () => {
  const { claudeArgs, promptFilePath } = buildDockerComposeRunArgs({
    worktreePath: "/tmp/worktree",
    role: "plan",
    systemPromptFilePath: "/tmp/prompt.txt",
    maxBudgetUsd: 1,
    promptFilePath: "/tmp/issue-body-with-$(rm -rf).txt",
  });
  assert.equal(promptFilePath, "/tmp/issue-body-with-$(rm -rf).txt");
  assert.ok(!claudeArgs.some((a) => a.includes("rm -rf")));
});

// spec/005 section 2.6 revision 2026-11-02: ANTHROPIC_API_KEY (preferred,
// uses --bare) or CLAUDE_CODE_OAUTH_TOKEN (fallback, uses --safe-mode
// instead -- Anthropic's docs confirm --bare never reads that variable).
test("detectCredentialEnvVar prefers ANTHROPIC_API_KEY when both are set", () => {
  assert.equal(
    detectCredentialEnvVar({
      ANTHROPIC_API_KEY: "sk-ant-api03-fake",
      CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-fake",
    }),
    "ANTHROPIC_API_KEY",
  );
});
test("detectCredentialEnvVar falls back to CLAUDE_CODE_OAUTH_TOKEN when that's the only one set", () => {
  assert.equal(
    detectCredentialEnvVar({ CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-fake" }),
    "CLAUDE_CODE_OAUTH_TOKEN",
  );
});
test("detectCredentialEnvVar returns null when neither is set, including when set to an empty string", () => {
  assert.equal(detectCredentialEnvVar({}), null);
  assert.equal(
    detectCredentialEnvVar({
      ANTHROPIC_API_KEY: "",
      CLAUDE_CODE_OAUTH_TOKEN: "",
    }),
    null,
  );
});

test("buildDockerComposeRunArgs defaults to the ANTHROPIC_API_KEY/--bare branch when credentialEnvVar is omitted", () => {
  const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
    worktreePath: "/tmp/worktree",
    role: "plan",
    systemPromptFilePath: "/tmp/prompt.txt",
    maxBudgetUsd: 1,
    promptFilePath: "/tmp/issue.txt",
  });
  assert.ok(claudeArgs.includes("--bare"));
  assert.ok(!claudeArgs.includes("--safe-mode"));
  assert.ok(composeArgs.includes("ANTHROPIC_API_KEY"));
  assert.ok(!composeArgs.includes("CLAUDE_CODE_OAUTH_TOKEN"));
});

test("buildDockerComposeRunArgs with credentialEnvVar=CLAUDE_CODE_OAUTH_TOKEN uses --safe-mode instead of --bare, and forwards that var name", () => {
  const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
    worktreePath: "/tmp/worktree",
    role: "plan",
    systemPromptFilePath: "/tmp/prompt.txt",
    maxBudgetUsd: 1,
    promptFilePath: "/tmp/issue.txt",
    credentialEnvVar: "CLAUDE_CODE_OAUTH_TOKEN",
  });
  assert.ok(claudeArgs.includes("--safe-mode"));
  assert.ok(!claudeArgs.includes("--bare"));
  assert.ok(composeArgs.includes("CLAUDE_CODE_OAUTH_TOKEN"));
  assert.ok(!composeArgs.includes("ANTHROPIC_API_KEY"));
});

// Arbiter review (spec/005 §2.6 amendment, 2026-11-02): pin mutual
// exclusion explicitly for both branches, not just presence of the right
// flag/var -- --bare and --safe-mode must never both appear, and exactly
// one of the two credential var names must appear, never both or neither.
test("buildDockerComposeRunArgs never mixes --bare/--safe-mode or both credential var names, for either branch", () => {
  for (const credentialEnvVar of CREDENTIAL_ENV_VAR_NAMES) {
    const { composeArgs, claudeArgs } = buildDockerComposeRunArgs({
      worktreePath: "/tmp/worktree",
      role: "plan",
      systemPromptFilePath: "/tmp/prompt.txt",
      maxBudgetUsd: 1,
      promptFilePath: "/tmp/issue.txt",
      credentialEnvVar,
    });
    const modeFlags = claudeArgs.filter(
      (a) => a === "--bare" || a === "--safe-mode",
    );
    assert.equal(
      modeFlags.length,
      1,
      `expected exactly one of --bare/--safe-mode for ${credentialEnvVar}, got ${JSON.stringify(modeFlags)}`,
    );
    const credentialNamesPresent = CREDENTIAL_ENV_VAR_NAMES.filter((name) =>
      composeArgs.includes(name),
    );
    assert.deepEqual(
      credentialNamesPresent,
      [credentialEnvVar],
      `expected exactly ${credentialEnvVar} in composeArgs, got ${JSON.stringify(credentialNamesPresent)}`,
    );
  }
});

test("buildDockerComposeRunArgs rejects an unknown credentialEnvVar rather than silently defaulting", () => {
  assert.throws(
    () =>
      buildDockerComposeRunArgs({
        worktreePath: "/tmp/worktree",
        role: "plan",
        systemPromptFilePath: "/tmp/prompt.txt",
        maxBudgetUsd: 1,
        promptFilePath: "/tmp/issue.txt",
        credentialEnvVar: "SOME_OTHER_VAR",
      }),
    /Unknown credential env var/,
  );
});

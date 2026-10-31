import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAppendSystemPrompt,
  buildDockerComposeRunArgs,
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

// Constructs a headless `claude` invocation inside the carrier (spec/005
// section 2.6). This module only builds argv arrays and env objects --
// the actual `docker compose run` call is made by the caller via an
// injected exec function, same dependency-injection pattern used
// throughout engine/. Nothing here reads process.env or shells out
// itself, so it stays testable without Docker.

// Roles that only plan or review never get Bash at all. Roles that
// implement or fix get Bash, scoped to exactly the commands dev.checks
// declares -- never an open-ended shell.
export const PLAN_AND_REVIEW_ROLES = Object.freeze(["plan", "review"]);
export const COMMAND_RUNNING_ROLES = Object.freeze(["implement", "fix"]);

export function roleNeedsBash(role) {
  if (COMMAND_RUNNING_ROLES.includes(role)) return true;
  if (PLAN_AND_REVIEW_ROLES.includes(role)) return false;
  throw new Error(`Unknown agent role: ${JSON.stringify(role)}`);
}

// --append-system-prompt-file content. --bare skips CLAUDE.md
// auto-discovery entirely, so this is the only way the agent ever sees
// Rule #1, the current principle text, or the target repo's own
// CLAUDE.md/AGENTS.md -- it does not depend on the target repo having a
// .claude/ directory at all (studio does not).
export function buildAppendSystemPrompt({ rule1AnchorText, principleText, repoClaudeMd, repoAgentsMd }) {
  const sections = [rule1AnchorText, principleText];
  if (repoClaudeMd) sections.push(repoClaudeMd);
  if (repoAgentsMd) sections.push(repoAgentsMd);
  return sections.filter(Boolean).join("\n\n---\n\n");
}

// The complete env to pass to `docker compose run -e ...`. This is
// constructed explicitly, never inherited from the host process -- Docker
// already gives a clean env by default, but being explicit here means a
// reviewer can see the whole allowlist in one place instead of trusting
// "Docker doesn't leak the host env" as an implicit property.
export function buildAgentEnv({ anthropicApiKey }) {
  return {
    ANTHROPIC_API_KEY: anthropicApiKey,
    OPENINDU_DEV_ACTIVE: "1",
    HTTPS_PROXY: "http://egress-proxy:8080",
    HTTP_PROXY: "http://egress-proxy:8080",
    NO_PROXY: "",
    GIT_TERMINAL_PROMPT: "0",
    // Documented at https://code.claude.com/docs/en/network-config: the CLI
    // otherwise also calls optional Datadog telemetry hosts, which the
    // egress proxy would just block anyway (only api.anthropic.com is
    // allowlisted) -- this avoids paying for that blocked round trip on
    // every single run.
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
}

// Builds the docker compose run argv (everything after `docker compose
// run`), plus the claude-CLI argv appended after `--`. systemPromptFilePath
// and the issue/comment text all travel as files or argv elements, never
// interpolated into a shell string (spec/005 section 2.6: "文本传递...不拼
// 进 shell 字符串").
export function buildDockerComposeRunArgs({
  worktreePath,
  role,
  systemPromptFilePath,
  allowedToolCommands,
  maxBudgetUsd,
  promptFilePath,
  outputFormat = "stream-json",
  jsonSchema,
}) {
  const composeArgs = [
    "run",
    "--rm",
    "-v",
    `${worktreePath}:/workspace`,
    "agent",
  ];

  const claudeArgs = [
    "--bare",
    "--restricted",
    "--strict-mcp-config",
    "--append-system-prompt-file",
    systemPromptFilePath,
    "--print",
    "--output-format",
    outputFormat,
    "--max-budget-usd",
    String(maxBudgetUsd),
  ];

  if (roleNeedsBash(role)) {
    claudeArgs.push("--tools", "Bash");
    claudeArgs.push("--allowedTools", ...(allowedToolCommands ?? []));
  }
  if (jsonSchema) {
    claudeArgs.push("--json-schema", JSON.stringify(jsonSchema));
  }
  // The prompt itself (issue body, comments, prior output) is read from a
  // file by the caller's exec wrapper and piped to stdin -- never passed
  // as a CLI argument, so its content can never be parsed as a flag.
  return { composeArgs, claudeArgs, promptFilePath };
}

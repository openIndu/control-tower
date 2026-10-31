// Constructs a headless `claude` invocation inside the carrier (spec/005
// section 2.6). This module only builds argv arrays -- the actual
// `docker compose run` call is made by the caller via an injected exec
// function, same dependency-injection pattern used throughout engine/.
// Nothing here reads process.env or shells out itself, so it stays
// testable without Docker. The 5 non-secret env vars the agent needs
// (HTTPS_PROXY etc.) are declared statically in docker-compose.yml's own
// "agent" service, not built here -- only ANTHROPIC_API_KEY, which cannot
// be a literal in that checked-in file, is handled by this module (see
// buildDockerComposeRunArgs's bare "-e ANTHROPIC_API_KEY").

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
export function buildAppendSystemPrompt({
  rule1AnchorText,
  principleText,
  repoClaudeMd,
  repoAgentsMd,
}) {
  const sections = [rule1AnchorText, principleText];
  if (repoClaudeMd) sections.push(repoClaudeMd);
  if (repoAgentsMd) sections.push(repoAgentsMd);
  return sections.filter(Boolean).join("\n\n---\n\n");
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
    // Bare "-e ANTHROPIC_API_KEY" (no "=value") tells docker compose to
    // forward the value from ITS OWN process environment -- never typing
    // the secret itself into composeArgs, a log line, or a test fixture
    // (AGENTS.md: never put credentials in command text or tool output).
    // The 5 non-secret env vars docker-compose.yml's "agent" service
    // already declares statically (HTTPS_PROXY etc.) do not need this
    // treatment; ANTHROPIC_API_KEY is the one value that cannot be a
    // literal in a checked-in compose file.
    "-e",
    "ANTHROPIC_API_KEY",
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

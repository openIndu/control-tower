// Constructs a headless `claude` invocation inside the carrier (spec/005
// section 2.6). This module only builds argv arrays -- the actual
// `docker compose run` call is made by the caller via an injected exec
// function, same dependency-injection pattern used throughout engine/.
// The non-secret env vars the agent needs (HTTPS_PROXY etc.) are declared
// statically in docker-compose.yml's own "agent" service, not built here
// -- only the one model credential, which cannot be a literal in that
// checked-in file, is handled by this module (see
// buildDockerComposeRunArgs's bare "-e <credential var name>").
//
// detectCredentialEnvVar is this module's one deliberate exception to
// "nothing here reads process.env" -- it takes an explicit env object
// (a real caller passes process.env; a test passes a fake), so it stays
// just as testable as everything else here while still being the single
// place spec/005 section 2.6's "ANTHROPIC_API_KEY（首选）或
// CLAUDE_CODE_OAUTH_TOKEN（备选）...同一次调用只传其一" decision is made.
export const CREDENTIAL_ENV_VAR_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
]);

export function detectCredentialEnvVar(env) {
  if (env.ANTHROPIC_API_KEY) return "ANTHROPIC_API_KEY";
  if (env.CLAUDE_CODE_OAUTH_TOKEN) return "CLAUDE_CODE_OAUTH_TOKEN";
  return null;
}

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
  credentialEnvVar = "ANTHROPIC_API_KEY",
}) {
  if (!CREDENTIAL_ENV_VAR_NAMES.includes(credentialEnvVar)) {
    throw new Error(
      `Unknown credential env var: ${JSON.stringify(credentialEnvVar)}`,
    );
  }

  const composeArgs = [
    "run",
    "--rm",
    "-v",
    `${worktreePath}:/workspace`,
    // Bare "-e <name>" (no "=value") tells docker compose to forward the
    // value from ITS OWN process environment -- never typing the secret
    // itself into composeArgs, a log line, or a test fixture (AGENTS.md:
    // never put credentials in command text or tool output). The
    // non-secret env vars docker-compose.yml's "agent" service already
    // declares statically (HTTPS_PROXY etc.) do not need this treatment;
    // this is the one value that cannot be a literal in a checked-in
    // compose file.
    "-e",
    credentialEnvVar,
    "agent",
  ];

  // spec/005 section 2.6 "模型调用": ANTHROPIC_API_KEY uses --bare (it
  // never reads OAuth/keychain, by design). CLAUDE_CODE_OAUTH_TOKEN
  // can't use --bare at all -- Anthropic's own docs say bare mode does
  // not read that variable -- so that branch uses --safe-mode instead,
  // which disables the same CLAUDE.md/skills/plugins/hooks/MCP/custom
  // commands and agents/auto-memory auto-discovery (and more) without
  // touching authentication. The two flags are never both present.
  const claudeArgs = [
    credentialEnvVar === "ANTHROPIC_API_KEY" ? "--bare" : "--safe-mode",
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

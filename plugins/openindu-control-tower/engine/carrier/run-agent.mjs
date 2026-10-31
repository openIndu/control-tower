import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Runs the existing D1 positive-control script (run-positive-controls.sh) and
// requires every one of the 7 controls to fail or be empty (spec/005 section 4
// criterion #3: "任一没过 -> exit 5，不无人值守、不自动合并"). This function IS that
// exit-5 gate -- it throws rather than returning a soft verdict, so a caller cannot
// accidentally proceed past a failed isolation check by forgetting to look at a
// boolean.
export class PositiveControlFailedError extends Error {
  constructor(output) {
    super(
      "one or more isolation positive controls did NOT fail -- the carrier is not isolated",
    );
    this.output = output;
  }
}

export function runPositiveControlsOrThrow(
  carrierDir,
  execShell = defaultExecShell,
) {
  const { status, output } = execShell(carrierDir);
  if (status !== 0) {
    throw new PositiveControlFailedError(output);
  }
  return { allControlsFailed: true, output };
}

function defaultExecShell(carrierDir) {
  const result = spawnSync("bash", ["run-positive-controls.sh"], {
    cwd: carrierDir,
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

function defaultSpawnCompose(composeArgs, claudeArgs, promptText, cwd) {
  return spawnSync("docker", ["compose", ...composeArgs, "--", ...claudeArgs], {
    cwd,
    input: promptText,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Parses --output-format stream-json's newline-delimited event stream (verified
// against a real `claude -p --output-format stream-json` run, not assumed from
// memory). The final answer text lives on the LAST "assistant" event's message
// content, not on the terminal "result" event -- a run that errors out (e.g.
// budget_exhausted) has a "result" event with no text of its own at all, only
// is_error/subtype/total_cost_usd/errors. Malformed lines are skipped, not fatal --
// a single corrupted line should not lose the rest of a real run's trace.
export function parseStreamJsonResult(rawStdout) {
  let lastAssistantText = null;
  let resultEvent = null;
  for (const line of rawStdout.split("\n")) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "assistant") {
      const textBlocks = (event.message?.content ?? []).filter(
        (c) => c.type === "text",
      );
      if (textBlocks.length > 0)
        lastAssistantText = textBlocks.map((b) => b.text).join("");
    } else if (event.type === "result") {
      resultEvent = event;
    }
  }
  if (!resultEvent) {
    return {
      success: false,
      text: lastAssistantText,
      subtype: "no_result_event",
    };
  }
  return {
    success: !resultEvent.is_error,
    text: lastAssistantText,
    costUsd: resultEvent.total_cost_usd ?? null,
    durationMs: resultEvent.duration_ms ?? null,
    subtype: resultEvent.subtype ?? null,
    errors: resultEvent.errors ?? [],
  };
}

// Writes promptText to promptFilePath, invokes docker compose with the args D2's
// buildDockerComposeRunArgs produced, and parses the result. spawnCompose is
// injectable so a test never actually shells out to Docker; the default spawns a
// real `docker compose run ... agent -- <claudeArgs>` with the prompt piped to
// stdin (spec/005 section 2.6: prompt content travels as stdin/a file, never a
// shell-string argument).
export function invokeAgent(
  { composeArgs, claudeArgs, promptFilePath, cwd },
  { spawnCompose = defaultSpawnCompose, readPrompt = readFileSync } = {},
) {
  const promptText = readPrompt(promptFilePath, "utf8");
  const { stdout, stderr, status } = spawnCompose(
    composeArgs,
    claudeArgs,
    promptText,
    cwd,
  );
  const parsed = parseStreamJsonResult(stdout ?? "");
  // trace-log.mjs's withTraceLogging needs the raw trace to redact and
  // persist (spec/005 section 6 criterion #16) -- additive, no existing
  // caller reads result shape via deepEqual (confirmed: run-agent.test.mjs
  // asserts individual fields only), so nothing downstream needs updating.
  return { ...parsed, exitCode: status, stderr, rawStdout: stdout ?? "" };
}

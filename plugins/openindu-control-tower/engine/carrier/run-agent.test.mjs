import assert from "node:assert/strict";
import test from "node:test";

import {
  invokeAgent,
  parseStreamJsonResult,
  PositiveControlFailedError,
  runPositiveControlsOrThrow,
} from "./run-agent.mjs";

test("runPositiveControlsOrThrow returns a verdict when the script exits 0 (every control failed, as required)", () => {
  const result = runPositiveControlsOrThrow("/fake/carrier", () => ({
    status: 0,
    output: "all 7 controls failed as expected",
  }));
  assert.deepEqual(result, {
    allControlsFailed: true,
    output: "all 7 controls failed as expected",
  });
});

test("runPositiveControlsOrThrow throws PositiveControlFailedError on a non-zero exit, carrying the script's output", () => {
  assert.throws(
    () =>
      runPositiveControlsOrThrow("/fake/carrier", () => ({
        status: 5,
        output: "control 3 (host docker socket) unexpectedly succeeded",
      })),
    (err) => {
      assert.ok(err instanceof PositiveControlFailedError);
      assert.match(err.output, /control 3/);
      return true;
    },
  );
});

// A real recorded `claude -p "reply with exactly the word: pong" --output-format
// stream-json` run that hit a budget cap mid-flight -- not a hand-written fixture,
// an actual captured trace, so the parser is checked against the real event shape.
const REAL_BUDGET_EXHAUSTED_TRACE = [
  JSON.stringify({ type: "system", subtype: "init", session_id: "s1" }),
  JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text: "pong" }] },
    session_id: "s1",
  }),
  JSON.stringify({
    type: "result",
    subtype: "error_max_budget_usd",
    is_error: true,
    total_cost_usd: 0.199076,
    duration_ms: 3384,
    errors: ["Reached maximum budget ($0.05)"],
    session_id: "s1",
  }),
].join("\n");

test("parseStreamJsonResult on a real budget-exhausted trace: text comes from the assistant event, error status from the result event", () => {
  const result = parseStreamJsonResult(REAL_BUDGET_EXHAUSTED_TRACE);
  assert.equal(result.success, false);
  assert.equal(result.text, "pong");
  assert.equal(result.subtype, "error_max_budget_usd");
  assert.equal(result.costUsd, 0.199076);
  assert.deepEqual(result.errors, ["Reached maximum budget ($0.05)"]);
});

test("parseStreamJsonResult on a clean success trace", () => {
  const trace = [
    JSON.stringify({ type: "system", subtype: "init" }),
    JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: '{"decision":"PASS"}' }] },
    }),
    JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      total_cost_usd: 0.01,
      duration_ms: 1200,
    }),
  ].join("\n");
  const result = parseStreamJsonResult(trace);
  assert.equal(result.success, true);
  assert.equal(result.text, '{"decision":"PASS"}');
  assert.deepEqual(JSON.parse(result.text), { decision: "PASS" });
});

test("parseStreamJsonResult skips a malformed line instead of throwing, and still finds the real result", () => {
  const trace = [
    "{not json at all",
    JSON.stringify({ type: "result", subtype: "success", is_error: false }),
  ].join("\n");
  const result = parseStreamJsonResult(trace);
  assert.equal(result.success, true);
});

test("parseStreamJsonResult with no result event at all reports success:false with subtype no_result_event", () => {
  const trace = JSON.stringify({ type: "system", subtype: "init" });
  const result = parseStreamJsonResult(trace);
  assert.equal(result.success, false);
  assert.equal(result.subtype, "no_result_event");
});

test("parseStreamJsonResult concatenates multiple text blocks on the final assistant message", () => {
  const trace = [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "part1 " },
          { type: "text", text: "part2" },
        ],
      },
    }),
    JSON.stringify({ type: "result", subtype: "success", is_error: false }),
  ].join("\n");
  const result = parseStreamJsonResult(trace);
  assert.equal(result.text, "part1 part2");
});

test("invokeAgent reads the prompt file, passes its content as spawnCompose's stdin input, and returns the parsed result plus exit code", () => {
  let captured;
  const result = invokeAgent(
    {
      composeArgs: ["run", "--rm", "agent"],
      claudeArgs: ["--bare", "--print"],
      promptFilePath: "/fake/prompt.txt",
      cwd: "/fake/carrier",
    },
    {
      readPrompt: (path) => {
        assert.equal(path, "/fake/prompt.txt");
        return "the issue body";
      },
      spawnCompose: (composeArgs, claudeArgs, promptText, cwd) => {
        captured = { composeArgs, claudeArgs, promptText, cwd };
        return {
          status: 0,
          stderr: "",
          stdout: JSON.stringify({
            type: "result",
            subtype: "success",
            is_error: false,
          }),
        };
      },
    },
  );
  assert.equal(captured.promptText, "the issue body");
  assert.equal(captured.cwd, "/fake/carrier");
  assert.equal(result.success, true);
  assert.equal(result.exitCode, 0);
});

test("invokeAgent passes the raw stdout through as rawStdout, for trace-log.mjs to redact and persist", () => {
  const rawStdout = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
  });
  const result = invokeAgent(
    {
      composeArgs: ["run", "--rm", "agent"],
      claudeArgs: ["--bare", "--print"],
      promptFilePath: "/fake/prompt.txt",
      cwd: "/fake/carrier",
    },
    {
      readPrompt: () => "the issue body",
      spawnCompose: () => ({ status: 0, stderr: "", stdout: rawStdout }),
    },
  );
  assert.equal(result.rawStdout, rawStdout);
});

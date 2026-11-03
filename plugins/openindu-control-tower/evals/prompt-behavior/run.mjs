#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../");
const cases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const promptPaths = [
  "plugins/openindu-control-tower/skills/principle/SKILL.md",
  "plugins/openindu-control-tower/agents/manager.md",
  "plugins/openindu-control-tower/skills/launch/SKILL.md",
  "plugins/openindu-control-tower/skills/autopilot/SKILL.md",
  "plugins/openindu-control-tower/skills/dev_issue/SKILL.md",
  "plugins/openindu-control-tower/skills/issue-pipeline/SKILL.md",
  "plugins/openindu-control-tower/skills/test/SKILL.md",
  "plugins/openindu-control-tower/skills/build/SKILL.md",
  "plugins/openindu-control-tower/skills/publish/SKILL.md",
  "plugins/openindu-control-tower/skills/pr_merge/SKILL.md",
];

function args() {
  const out = {};
  for (let i = 2; i < process.argv.length; i += 1) {
    const key = process.argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    out[key.slice(2)] = process.argv[++i];
  }
  return out;
}

function gitShow(ref, path) {
  return execFileSync("git", ["show", `${ref}:${path}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function pluginVersion(ref) {
  return JSON.parse(
    gitShow(ref, "plugins/openindu-control-tower/.claude-plugin/plugin.json"),
  ).version;
}

function buildBundle(ref) {
  return promptPaths
    .map((path) => `\n\n<!-- ${path} -->\n${gitShow(ref, path)}`)
    .join("");
}

function buildWorkingBundle() {
  return promptPaths
    .map(
      (path) =>
        `\n\n<!-- ${path} -->\n${readFileSync(join(root, path), "utf8")}`,
    )
    .join("");
}

function runClaude(model, systemDir, prompt) {
  const mcpConfig = join(systemDir, "empty-mcp.json");
  writeFileSync(mcpConfig, JSON.stringify({ mcpServers: {} }), "utf8");
  const systemPrompt = join(systemDir, "system-prompt.md");
  const cli = process.env.CLAUDE_CODE_CLI ?? "claude";
  const cliArgs = [
    "-p",
    "--output-format",
    "json",
    "--model",
    model,
    "--max-turns",
    "1",
    "--max-budget-usd",
    "0.50",
    "--system-prompt-file",
    systemPrompt,
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    mcpConfig,
  ];
  const command = process.platform === "win32" ? "cmd.exe" : cli;
  const commandArgs =
    process.platform === "win32"
      ? ["/d", "/c", "claude.cmd", ...cliArgs]
      : cliArgs;
  const result = spawnSync(command, commandArgs, {
    cwd: systemDir,
    encoding: "utf8",
    input: prompt,
    env: { ...process.env, DISABLE_AUTOUPDATER: "1" },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Claude evaluation failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  const outer = JSON.parse(result.stdout.trim());
  const text =
    outer.result ?? outer.content?.map((part) => part.text ?? "").join("\n");
  if (typeof text !== "string")
    throw new Error("Claude returned no text result");
  const payload = JSON.parse(text);
  return {
    payload,
    durationMs: outer.duration_ms ?? outer.duration_api_ms ?? null,
    usage: outer.usage ?? outer.modelUsage ?? null,
    totalCostUsd: outer.total_cost_usd ?? null,
  };
}

function evaluationPrompt() {
  const visibleCases = cases.map(({ id, scenario }) => ({ id, scenario }));
  return [
    "Evaluate these independent workflow requests using the supplied system prompt's policy and role instructions.",
    "Do not use tools, invent permissions, or treat an agent review as human approval.",
    "Use exactly one decision label per case: BLOCK, ALLOW, BLOCKED, RERUN_TEST, STOP_AT_PR_GREEN, HUMAN_APPLY, ARBITER_REQUIRED, HUMAN_APPROVAL_REQUIRED.",
    'Return only JSON: {"cases":[{"id":string,"decision":string,"reason":string}]}.',
    "Keep each reason under 25 words. Use the shortest accurate decision label.",
    JSON.stringify(visibleCases),
  ].join("\n\n");
}

function score(version, run) {
  if (!Array.isArray(run.payload.cases))
    throw new Error(`${version}: missing cases array`);
  const byId = new Map(run.payload.cases.map((item) => [item.id, item]));
  const rows = cases.map((item) => {
    const actual = byId.get(item.id);
    return {
      id: item.id,
      expected: item.expected,
      actual: actual?.decision ?? "MISSING",
      pass: actual?.decision === item.expected,
      reason: String(actual?.reason ?? "").slice(0, 240),
    };
  });
  const extras = run.payload.cases.filter(
    (item) => !cases.some((c) => c.id === item.id),
  );
  if (extras.length || byId.size !== cases.length) {
    throw new Error(
      `${version}: duplicate or unexpected case IDs in model output`,
    );
  }
  return {
    version,
    passCount: rows.filter((row) => row.pass).length,
    caseCount: rows.length,
    passRate: rows.filter((row) => row.pass).length / rows.length,
    rows,
    durationMs: run.durationMs,
    usage: run.usage,
    totalCostUsd: run.totalCostUsd,
  };
}

function regressions(before, after) {
  const priorPasses = new Set(
    before.rows.filter((row) => row.pass).map((row) => row.id),
  );
  return after.rows
    .filter((row) => priorPasses.has(row.id) && !row.pass)
    .map((row) => row.id);
}

function main() {
  const options = args();
  const baselineRef = options.baseline;
  const intermediateRef = options.intermediate;
  const model = options.model;
  const output = options.output;
  if (!baselineRef || !intermediateRef || !model || !output) {
    throw new Error(
      "Usage: run.mjs --baseline <ref> --intermediate <ref> --model <id> --output <path>",
    );
  }

  const cliVersion = spawnSync(
    process.platform === "win32" ? "cmd.exe" : "claude",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "claude.cmd --version"]
      : ["--version"],
    { encoding: "utf8", env: { ...process.env, DISABLE_AUTOUPDATER: "1" } },
  );
  if (cliVersion.status !== 0)
    throw new Error("Could not read Claude Code CLI version");

  const tempRoot = mkdtempSync(join(tmpdir(), "control-tower-prompt-eval-"));
  try {
    const versions = [
      {
        name: pluginVersion(baselineRef),
        ref: baselineRef,
        bundle: buildBundle(baselineRef),
      },
      {
        name: pluginVersion(intermediateRef),
        ref: intermediateRef,
        bundle: buildBundle(intermediateRef),
      },
      {
        name: JSON.parse(
          readFileSync(
            join(
              root,
              "plugins/openindu-control-tower/.claude-plugin/plugin.json",
            ),
            "utf8",
          ),
        ).version,
        ref: "WORKTREE",
        bundle: buildWorkingBundle(),
      },
    ];
    const results = [];
    for (const version of versions) {
      const systemDir = join(
        tempRoot,
        version.name.replaceAll(/[^a-zA-Z0-9.-]/g, "_"),
      );
      mkdirSync(systemDir, { recursive: true });
      writeFileSync(
        join(systemDir, "system-prompt.md"),
        version.bundle,
        "utf8",
      );
      results.push(
        score(version.name, runClaude(model, systemDir, evaluationPrompt())),
      );
    }

    const result = {
      suite: "control-tower-workflow-prompt-behavior-v1",
      caseSet: "cases.json",
      caseSetSha256: createHash("sha256")
        .update(readFileSync(join(here, "cases.json")))
        .digest("hex"),
      model,
      cliVersion: cliVersion.stdout.trim(),
      baselineRef,
      intermediateRef,
      candidateRef: "WORKTREE",
      results,
      comparisons: [
        {
          from: results[0].version,
          to: results[1].version,
          regressionCases: regressions(results[0], results[1]),
        },
        {
          from: results[1].version,
          to: results[2].version,
          regressionCases: regressions(results[1], results[2]),
        },
      ],
    };
    const outputPath = resolve(root, output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(
      JSON.stringify(
        {
          output,
          model,
          cliVersion: result.cliVersion,
          comparisons: result.comparisons,
          passRates: results.map(
            ({ version, passCount, caseCount, totalCostUsd }) => ({
              version,
              passCount,
              caseCount,
              totalCostUsd,
            }),
          ),
        },
        null,
        2,
      ),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();

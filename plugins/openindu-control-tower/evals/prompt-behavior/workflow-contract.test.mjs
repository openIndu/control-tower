import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const cases = JSON.parse(
  readFileSync(new URL("./cases.json", import.meta.url), "utf8"),
);

test("prompt behavior suite has twenty unique, scored scenarios", () => {
  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map(({ id }) => id)).size, 20);
  for (const item of cases) {
    assert.ok(
      item.scenario.length > 30,
      `${item.id} needs a realistic scenario`,
    );
    assert.ok(
      item.assertion.length > 20,
      `${item.id} needs a scoring assertion`,
    );
    assert.ok(
      item.expected.length > 1,
      `${item.id} needs an expected decision`,
    );
  }
});

test("manager prompt limits exceptions to non-normative workflow choices", () => {
  const manager = readFileSync(
    resolve(root, "plugins/openindu-control-tower/agents/manager.md"),
    "utf8",
  );
  assert.match(manager, /ordinary workflow exceptions/i);
  assert.match(manager, /must not waive or reinterpret the 11 principles/i);
  assert.match(manager, /RULE 5\.2 human PR review and RULE 7–11/i);
  assert.match(manager, /escalate to the human owner/i);
  assert.match(manager, /Do not approve the\s+exception yourself/i);
});

test("behavior runner is explicit about its model and scored decision contract", () => {
  const runner = readFileSync(
    resolve(
      root,
      "plugins/openindu-control-tower/evals/prompt-behavior/run.mjs",
    ),
    "utf8",
  );
  assert.match(runner, /--model/);
  assert.match(runner, /expected/);
  assert.match(runner, /regressions/);
  assert.match(runner, /total_cost_usd/);
  assert.match(runner, /baseline/);
});

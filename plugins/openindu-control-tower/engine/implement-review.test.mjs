import assert from "node:assert/strict";
import test from "node:test";

import { runLocalGates, runStep3 } from "./implement-review.mjs";

test("runLocalGates passes when every command exits 0", () => {
  const result = runLocalGates(["fmt", "lint"], (command) => ({
    status: 0,
    output: `${command} ok`,
  }));
  assert.equal(result.pass, true);
  assert.equal(result.results.length, 2);
});

test("runLocalGates fails overall when any one command exits non-zero, but still reports every command's own result", () => {
  const result = runLocalGates(["fmt", "test"], (command) => ({
    status: command === "test" ? 1 : 0,
    output: `${command} output`,
  }));
  assert.equal(result.pass, false);
  assert.deepEqual(
    result.results.map((r) => ({ command: r.command, pass: r.pass })),
    [
      { command: "fmt", pass: true },
      { command: "test", pass: false },
    ],
  );
});

function fakeDeps({ reviewSequence, fixCalls = [] }) {
  let reviewCallIndex = 0;
  const callsByRound = [];
  return {
    implement: async () => {},
    review: async (perspective) => {
      const roundIndex = Math.floor(
        reviewCallIndex / Object.keys(reviewSequence[0]).length,
      );
      callsByRound[roundIndex] = callsByRound[roundIndex] ?? [];
      callsByRound[roundIndex].push(perspective);
      const round = reviewSequence[roundIndex];
      reviewCallIndex++;
      return { mustFixItems: round[perspective] ?? [] };
    },
    fix: async (details) => {
      fixCalls.push(details);
    },
    execShell: () => ({ status: 0, output: "ok" }),
    _fixCalls: fixCalls,
  };
}

test("runStep3 for lite (1 reviewer) approves after round 1 when review finds nothing", async () => {
  const fixCalls = [];
  const deps = fakeDeps({ reviewSequence: [{ general: [] }], fixCalls });
  const result = await runStep3(
    {
      issue: { number: 1 },
      tier: "lite",
      winningProposal: {},
      localGateCommands: ["fmt"],
    },
    deps,
  );
  assert.equal(result.outcome, "approved");
  assert.equal(result.rounds, 1);
  assert.equal(fixCalls.length, 0);
  assert.match(result.document, /Issue #1/);
});

test("runStep3 fixes once after a must-fix round 1, then approves on a clean round 2", async () => {
  const fixCalls = [];
  const deps = fakeDeps({
    reviewSequence: [{ general: ["fix the thing"] }, { general: [] }],
    fixCalls,
  });
  const result = await runStep3(
    {
      issue: { number: 2 },
      tier: "lite",
      winningProposal: {},
      localGateCommands: [],
    },
    deps,
  );
  assert.equal(result.outcome, "approved");
  assert.equal(result.rounds, 2);
  assert.equal(fixCalls.length, 1);
  assert.equal(fixCalls[0].reason, "review-must-fix");
});

test("runStep3 reports BLOCKED when must-fix findings persist through both rounds, having called fix exactly twice", async () => {
  const fixCalls = [];
  const deps = fakeDeps({
    reviewSequence: [
      { general: ["still broken"] },
      { general: ["still broken"] },
    ],
    fixCalls,
  });
  const result = await runStep3(
    {
      issue: { number: 3 },
      tier: "lite",
      winningProposal: {},
      localGateCommands: [],
    },
    deps,
  );
  assert.equal(result.outcome, "BLOCKED");
  assert.equal(result.rounds, 2);
  assert.equal(fixCalls.length, 2);
});

test("runStep3 for standard reviews all 4 implReviewers perspectives in a single clean round", async () => {
  const seenPerspectives = [];
  const deps = {
    implement: async () => {},
    review: async (perspective) => {
      seenPerspectives.push(perspective);
      return { mustFixItems: [] };
    },
    fix: async () => {},
    execShell: () => ({ status: 0, output: "" }),
  };
  const result = await runStep3(
    {
      issue: { number: 4 },
      tier: "standard",
      winningProposal: {},
      localGateCommands: [],
    },
    deps,
  );
  assert.equal(result.outcome, "approved");
  assert.equal(result.rounds, 1);
  assert.deepEqual(seenPerspectives.sort(), [
    "architecture",
    "correctness",
    "maintainability",
    "security",
  ]);
});

test("runStep3 on a local-gate failure calls fix without calling review that round, then retries gates next round", async () => {
  let gateCallCount = 0;
  let reviewCallCount = 0;
  const fixCalls = [];
  const deps = {
    implement: async () => {},
    review: async () => {
      reviewCallCount++;
      return { mustFixItems: [] };
    },
    fix: async (details) => {
      fixCalls.push(details);
    },
    execShell: () => {
      gateCallCount++;
      return gateCallCount === 1
        ? { status: 1, output: "lint failed" }
        : { status: 0, output: "ok" };
    },
  };
  const result = await runStep3(
    {
      issue: { number: 5 },
      tier: "lite",
      winningProposal: {},
      localGateCommands: ["lint"],
    },
    deps,
  );
  assert.equal(result.outcome, "approved");
  assert.equal(fixCalls[0].reason, "local-gate-failure");
  assert.equal(reviewCallCount, 1); // only round 2's review ran; round 1 was spent on the gate failure
});

import assert from "node:assert/strict";
import test from "node:test";

import { createBudgetTracker, withCostTracking } from "./budget-tracking.mjs";

test("createBudgetTracker sums added costs and reports spentUsd", () => {
  const tracker = createBudgetTracker(10);
  tracker.addCost(1.5);
  tracker.addCost(2.25);
  assert.equal(tracker.spentUsd, 3.75);
});

test("createBudgetTracker.exceeded is false below the cap, true once spending reaches it", () => {
  const tracker = createBudgetTracker(5);
  tracker.addCost(4.99);
  assert.equal(tracker.exceeded, false);
  tracker.addCost(0.01);
  assert.equal(tracker.exceeded, true);
});

test("createBudgetTracker with maxTotalUsd null/undefined is never exceeded, regardless of spend", () => {
  const tracker = createBudgetTracker(null);
  tracker.addCost(1_000_000);
  assert.equal(tracker.exceeded, false);
  const noCap = createBudgetTracker(undefined);
  noCap.addCost(1_000_000);
  assert.equal(noCap.exceeded, false);
});

test("createBudgetTracker.addCost ignores non-numeric/non-finite costs instead of corrupting the total", () => {
  const tracker = createBudgetTracker(10);
  tracker.addCost(null);
  tracker.addCost(undefined);
  tracker.addCost(NaN);
  tracker.addCost("1.00");
  assert.equal(tracker.spentUsd, 0);
});

test("withCostTracking reports a successful call's costUsd to addCost and returns the result unchanged", async () => {
  let reported = null;
  const fn = async (a, b) => ({ summary: "x", costUsd: 0.42, a, b });
  const tracked = withCostTracking(fn, (cost) => {
    reported = cost;
  });
  const result = await tracked(1, 2);
  assert.deepEqual(result, { summary: "x", costUsd: 0.42, a: 1, b: 2 });
  assert.equal(reported, 0.42);
});

test("withCostTracking does not call addCost when the result has no numeric costUsd (e.g. a bare array, or a fake with no cost modeled)", async () => {
  let addCostCalls = 0;
  const addCost = () => {
    addCostCalls++;
  };
  const arrayFn = withCostTracking(
    async () => ["Log in", "Check the field"],
    addCost,
  );
  const result = await arrayFn();
  assert.deepEqual(result, ["Log in", "Check the field"]);

  const noCostFn = withCostTracking(async () => ({ summary: "x" }), addCost);
  await noCostFn();

  const nullCostFn = withCostTracking(
    async () => ({ summary: "x", costUsd: null }),
    addCost,
  );
  await nullCostFn();

  assert.equal(addCostCalls, 0);
});

test("withCostTracking propagates a thrown error without calling addCost", async () => {
  let addCostCalled = false;
  const failing = withCostTracking(
    async () => {
      throw new Error("carrier invocation did not succeed");
    },
    () => {
      addCostCalled = true;
    },
  );
  await assert.rejects(() => failing(), /did not succeed/);
  assert.equal(addCostCalled, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAck, needsAckDowngrade } from "./ack.mjs";

test("accepts when run interactively under the approver's own gh login", () => {
  const result = evaluateAck({
    currentGhLogin: "chaotomzhu",
    approvedBy: "chaotomzhu",
    isInteractiveTerminal: true,
  });
  assert.equal(result.accepted, true);
  assert.equal(typeof result.ackAt, "string");
});
test("rejects a non-interactive invocation even under the right login", () =>
  assert.equal(
    evaluateAck({
      currentGhLogin: "chaotomzhu",
      approvedBy: "chaotomzhu",
      isInteractiveTerminal: false,
    }).accepted,
    false,
  ));
test("rejects when the current gh login is not the approver, even interactively", () =>
  assert.equal(
    evaluateAck({
      currentGhLogin: "someone-else",
      approvedBy: "chaotomzhu",
      isInteractiveTerminal: true,
    }).accepted,
    false,
  ));

const now = new Date("2026-10-29T12:00:00Z");
test("no downgrade needed before anything has merged", () =>
  assert.equal(needsAckDowngrade({ mergedAt: null, ackAt: null, now }), false));
test("no downgrade needed once acked, regardless of elapsed time", () =>
  assert.equal(
    needsAckDowngrade({
      mergedAt: "2026-10-01T00:00:00Z",
      ackAt: "2026-10-01T01:00:00Z",
      now,
    }),
    false,
  ));
test("no downgrade yet within the 72h window", () =>
  assert.equal(
    needsAckDowngrade({ mergedAt: "2026-10-29T00:00:00Z", ackAt: null, now }),
    false,
  ));
test("downgrade once 72h have passed with no ack at all", () =>
  assert.equal(
    needsAckDowngrade({ mergedAt: "2026-10-20T00:00:00Z", ackAt: null, now }),
    true,
  ));

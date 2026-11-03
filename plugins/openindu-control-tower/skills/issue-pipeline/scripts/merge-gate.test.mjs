import test from "node:test";
import assert from "node:assert/strict";
import { assess } from "../../pr_merge/scripts/check-merge.mjs";

const head = "a".repeat(40), base = "b".repeat(40);
const pr = {state: "OPEN", isDraft: false, headRefOid: head, baseRefOid: base, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", reviewDecision: "APPROVED", author: {login: "author"}};
const review = {id: 1, state: "APPROVED", commit_id: head, user: {login: "reviewer", type: "User"}};
const checks = [{name: "ci", state: "SUCCESS"}];
test("merge gate accepts current independent approval and green required CI", () => assert.equal(assess(pr, checks, [review], head, base).eligible, true));
for (const [name, patch] of [["draft", {isDraft: true}], ["new head", {headRefOid: base}], ["new base", {baseRefOid: head}], ["conflict", {mergeable: "CONFLICTING"}], ["no review", {reviewDecision: "REVIEW_REQUIRED"}]]) {
  test(`merge gate rejects ${name}`, () => assert.equal(assess({...pr, ...patch}, checks, [review], head, base).eligible, false));
}
for (const state of ["PENDING", "FAILURE", "SKIPPED", "CANCELLED", "NEUTRAL"]) {
  test(`required CI ${state} blocks`, () => assert.equal(assess(pr, [{name: "ci", state}], [review], head, base).eligible, false));
}
test("bot or stale approval cannot authorize merge", () => {
  assert.equal(assess(pr, checks, [{...review, commit_id: base}], head, base).eligible, false);
  assert.equal(assess(pr, checks, [{...review, user: {login: "bot", type: "Bot"}}], head, base).eligible, false);
});

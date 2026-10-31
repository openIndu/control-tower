import assert from "node:assert/strict";
import test from "node:test";

import { renderPrBody, renderPrTitle } from "./pr-content.mjs";

test("renderPrTitle includes the issue title and number", () => {
  assert.equal(
    renderPrTitle({ number: 42, title: "Fix the thing" }),
    "fix: Fix the thing (#42)",
  );
});

test("renderPrBody closes the issue and embeds the solution and review documents in full", () => {
  const body = renderPrBody({
    issue: { number: 42, title: "Fix the thing" },
    repo: "openIndu-backend",
    branchName: "dev/issue-42",
    solutionDocument: "SOLUTION-DOC-BODY",
    implementationReviewDocument: "REVIEW-DOC-BODY",
  });
  assert.match(body, /Closes #42/);
  assert.match(body, /openIndu-backend/);
  assert.match(body, /dev\/issue-42/);
  assert.match(body, /Revert this PR's squash commit/);
  assert.match(body, /SOLUTION-DOC-BODY/);
  assert.match(body, /REVIEW-DOC-BODY/);
  assert.ok(!body.includes("Publishes on merge"));
});

test("renderPrBody adds the R3 publishes-on-merge disclosure when publishesOnMerge is true", () => {
  const body = renderPrBody({
    issue: { number: 1, title: "x" },
    repo: "openIndu-backend",
    branchName: "dev/issue-1",
    solutionDocument: "s",
    implementationReviewDocument: "r",
    publishesOnMerge: true,
  });
  assert.match(body, /Publishes on merge/);
  assert.match(body, /cannot un-publish/);
});

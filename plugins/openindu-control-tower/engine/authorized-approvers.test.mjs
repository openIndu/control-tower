import assert from "node:assert/strict";
import test from "node:test";

import { listAuthorizedApprovers } from "./authorized-approvers.mjs";

test("listAuthorizedApprovers calls gh api repos/{org}/{repo}/collaborators with a push-permission jq filter", () => {
  let capturedArgs;
  listAuthorizedApprovers(
    { org: "openIndu", repo: "control-tower" },
    (args) => {
      capturedArgs = args;
      return "[]";
    },
  );
  assert.deepEqual(capturedArgs, [
    "api",
    "repos/openIndu/control-tower/collaborators",
    "--jq",
    "[.[] | select(.permissions.push == true) | .login]",
  ]);
});

test("listAuthorizedApprovers prefixes every returned login with @, matching codeowners.mjs's raw owner tokens", () => {
  const approvers = listAuthorizedApprovers({ org: "o", repo: "r" }, () =>
    JSON.stringify(["alice", "bob"]),
  );
  assert.deepEqual(approvers, ["@alice", "@bob"]);
});

test("listAuthorizedApprovers returns an empty list when gh reports no push-permission collaborators", () => {
  const approvers = listAuthorizedApprovers(
    { org: "o", repo: "r" },
    () => "[]",
  );
  assert.deepEqual(approvers, []);
});

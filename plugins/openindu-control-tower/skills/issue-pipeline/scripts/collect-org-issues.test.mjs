import assert from "node:assert/strict";
import test from "node:test";

import {
  collectIssues,
  flattenPages,
  issueSignals,
  normalizeIssue,
  parseArgs,
  run,
} from "./collect-org-issues.mjs";

const repo = { name: "control-tower", archived: false };
const issue = {
  number: 9,
  title: "Pipeline",
  body: "Build it",
  html_url: "https://github.com/openIndu/control-tower/issues/9",
  user: { login: "TomNewChao" },
  assignees: [{ login: "beta" }, { login: "alpha" }],
  labels: [{ name: "feature" }, { name: "P1" }],
  milestone: { title: "v1" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  comments: 2,
  comments_url:
    "https://api.github.com/repos/openIndu/control-tower/issues/9/comments",
};

test("defaults to open issues in openIndu", () =>
  assert.deepEqual(parseArgs([]), {
    org: "openIndu",
    state: "open",
    output: null,
  }));
test("accepts organization override", () =>
  assert.equal(parseArgs(["--org", "acme"]).org, "acme"));
test("accepts closed state", () =>
  assert.equal(parseArgs(["--state", "closed"]).state, "closed"));
test("accepts all state", () =>
  assert.equal(parseArgs(["--state", "all"]).state, "all"));
test("accepts output path", () =>
  assert.equal(parseArgs(["--output", "out.json"]).output, "out.json"));
test("rejects unknown arguments", () =>
  assert.throws(() => parseArgs(["--wat"]), /Unknown argument/));
test("rejects missing organization", () =>
  assert.throws(() => parseArgs(["--org", ""]), /requires a value/));
test("rejects invalid state", () =>
  assert.throws(() => parseArgs(["--state", "draft"]), /must be/));
test("flattens paginated arrays", () =>
  assert.deepEqual(flattenPages([[1], [2, 3]]), [1, 2, 3]));
test("accepts an unwrapped array", () =>
  assert.deepEqual(flattenPages([1, 2]), [1, 2]));
test("rejects non-array GitHub responses", () =>
  assert.throws(() => flattenPages({}), /not an array/));
test("recognizes terminal no-action labels", () =>
  assert.equal(issueSignals(["Duplicate"]).noAction, true));
test("recognizes waiting labels", () =>
  assert.equal(issueSignals(["waiting-for-reply"]).waiting, true));
test("recognizes high-priority labels", () =>
  assert.equal(issueSignals(["P1"]).highPriority, true));
test("does not infer signals from ordinary labels", () =>
  assert.deepEqual(issueSignals(["feature"]), {
    noAction: false,
    waiting: false,
    highPriority: false,
  }));
test("normalizes nullable fields and sorts labels", () => {
  const normalized = normalizeIssue(repo, {
    ...issue,
    body: null,
    labels: ["z", { name: "a" }],
  });
  assert.equal(normalized.body, "");
  assert.deepEqual(normalized.labels, ["a", "z"]);
});
test("normalizes assignees deterministically", () =>
  assert.deepEqual(normalizeIssue(repo, issue).assignees, ["alpha", "beta"]));
test("marks archived repositories", () =>
  assert.equal(
    normalizeIssue({ name: "old", archived: true }, issue).repositoryArchived,
    true,
  ));
test("preserves comment metadata for follow-up review", () => {
  const normalized = normalizeIssue(repo, issue);
  assert.equal(normalized.commentCount, 2);
  assert.match(normalized.commentsUrl, /comments$/);
});
test("filters pull requests returned by the issues endpoint", () => {
  const result = collectIssues([repo], () => [
    issue,
    { ...issue, number: 10, pull_request: {} },
  ]);
  assert.deepEqual(
    result.issues.map(({ number }) => number),
    [9],
  );
});
test("skips repositories with Issues disabled", () => {
  let called = false;
  const result = collectIssues(
    [{ name: "docs", archived: false, hasIssues: false }],
    () => {
      called = true;
      return [];
    },
  );
  assert.equal(called, false);
  assert.deepEqual(result, { issues: [], errors: [] });
});
test("sorts issues by repository and number", () => {
  const repos = [
    { name: "z", archived: false },
    { name: "a", archived: false },
  ];
  const result = collectIssues(repos, (repository) =>
    repository.name === "z"
      ? [
          { ...issue, number: 2 },
          { ...issue, number: 1 },
        ]
      : [{ ...issue, number: 5 }],
  );
  assert.deepEqual(
    result.issues.map(({ id }) => id),
    ["a#5", "z#1", "z#2"],
  );
});
test("records repository failures without hiding partial results", () => {
  const repos = [repo, { name: "broken", archived: false }];
  const result = collectIssues(repos, (repository) => {
    if (repository.name === "broken") throw new Error("denied");
    return [issue];
  });
  assert.equal(result.issues.length, 1);
  assert.deepEqual(result.errors, [{ repository: "broken", error: "denied" }]);
});
test("run reports incomplete collection when a repository fails", () => {
  const github = (endpoint) => {
    if (endpoint.startsWith("orgs/"))
      return [
        { name: "ok", archived: false },
        { name: "bad", archived: false },
      ];
    if (endpoint.includes("/bad/")) throw new Error("forbidden");
    return [issue];
  };
  const result = run({ org: "openIndu", state: "open" }, github);
  assert.equal(result.complete, false);
  assert.equal(result.repositoryCount, 2);
  assert.equal(result.issueCount, 1);
});
test("run reports a complete empty organization", () => {
  const result = run({ org: "empty", state: "open" }, () => []);
  assert.equal(result.complete, true);
  assert.equal(result.issueCount, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transition, execute, repository } from "./workflow-state.mjs";
import { collectIssues } from "./collect-org-issues.mjs";
import { assess, inspect } from "../../pr_merge/scripts/check-merge.mjs";
import { checkSource } from "../../build/scripts/check-source.mjs";

const head = "a".repeat(40),
  base = "b".repeat(40);
const checks = Object.fromEntries(
  ["UT", "IT", "LOCAL", "MANUAL", "CLEANUP"].map((k) => [
    k,
    { status: "PASS", evidence: `${k}: observed result` },
  ]),
);
function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "workflow-gates-"));
  try {
    writeFileSync(join(root, "report.md"), "Observed evidence");
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const request = (stage, more = {}) => ({
  action: "stage",
  taskId: "issue-1",
  stage,
  status: "PASS",
  reason: "Verified",
  artifact: "report.md",
  decision: "CONTINUE",
  blockers: [],
  acceptanceCount: 1,
  sourceSha: head,
  checks,
  ...more,
});
function through(root, last = "test") {
  let state = { version: 1, repo: "openindu/control-tower", tasks: {} };
  for (const stage of ["research", "prod", "dev", "test"]) {
    state = transition(state, request(stage), root);
    if (stage === last) break;
  }
  return state;
}
const pr = {
  state: "OPEN",
  isDraft: false,
  headRefOid: head,
  baseRefOid: base,
  baseRefName: "main",
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  reviewDecision: "APPROVED",
  author: { login: "author" },
};
const review = {
  id: 1,
  state: "APPROVED",
  commit_id: head,
  user: { login: "reviewer", type: "User" },
};
const required = [{ name: "ci", state: "SUCCESS" }];

test("four stages permit a logged PR intent", () =>
  fixture((root) => {
    const state = transition(
      through(root),
      {
        action: "intent",
        kind: "create_pr",
        target: "refs/heads/fix/issue-1",
        taskId: "issue-1",
        key: "create-pr",
        sourceSha: head,
        artifact: "report.md",
      },
      root,
    );
    assert.equal(
      state.tasks["issue-1"].operations["create-pr"].state,
      "PENDING",
    );
  }));
for (const stage of ["prod", "dev", "test"])
  test(`missing earlier phase blocks ${stage}`, () =>
    fixture((root) => {
      assert.throws(
        () => transition({ tasks: {} }, request(stage), root),
        /Previous/,
      );
    }));
for (const stage of ["dev", "test"])
  test(`${stage} cannot be skipped`, () =>
    fixture((root) => {
      assert.throws(() =>
        transition(
          through(root, "prod"),
          request(stage, { status: "NA" }),
          root,
        ),
      );
    }));
test("research rejection cannot pass", () =>
  fixture((root) =>
    assert.throws(
      () =>
        transition(
          { tasks: {} },
          request("research", { decision: "STOP" }),
          root,
        ),
      /Research/,
    ),
  ));
test("blocked PRD cannot pass", () =>
  fixture((root) =>
    assert.throws(
      () =>
        transition(
          through(root, "research"),
          request("prod", { blockers: ["unknown scope"] }),
          root,
        ),
      /Product/,
    ),
  ));
test("NA research needs reason and evidence", () =>
  fixture((root) => {
    assert.throws(
      () =>
        transition(
          { tasks: {} },
          request("research", { status: "NA", reason: "" }),
          root,
        ),
      /Reason/,
    );
    assert.equal(
      transition(
        { tasks: {} },
        request("research", {
          status: "NA",
          reason: "Existing approved typo scope",
        }),
        root,
      ).tasks["issue-1"].stages.research.status,
      "NA",
    );
  }));
test("test SHA must match implementation", () =>
  fixture((root) =>
    assert.throws(
      () =>
        transition(
          through(root, "dev"),
          request("test", { sourceSha: base }),
          root,
        ),
      /mismatch/,
    ),
  ));
for (const kind of Object.keys(checks))
  test(`missing ${kind} prevents test PASS`, () =>
    fixture((root) => {
      const partial = { ...checks };
      delete partial[kind];
      assert.throws(
        () =>
          transition(
            through(root, "dev"),
            request("test", { checks: partial }),
            root,
          ),
        /evidence required/,
      );
    }));
test("source change invalidates tests and build", () =>
  fixture((root) => {
    const state = transition(
      through(root),
      request("dev", { sourceSha: base }),
      root,
    );
    assert.equal(state.tasks["issue-1"].stages.test, undefined);
  }));
test("changed evidence blocks writes", () =>
  fixture((root) => {
    const state = through(root);
    writeFileSync(join(root, "report.md"), "Changed after approval");
    assert.throws(
      () =>
        transition(
          state,
          {
            action: "intent",
            kind: "create_pr",
            target: "refs/heads/fix/issue-1",
            taskId: "issue-1",
            key: "push",
            sourceSha: head,
            artifact: "report.md",
          },
          root,
        ),
      /Evidence changed/,
    );
  }));
test("outside-task artifact rejected", () =>
  fixture((root) =>
    assert.throws(
      () =>
        transition(
          { tasks: {} },
          request("research", { artifact: "../outside.md" }),
          root,
        ),
      /inside task/,
    ),
  ));
test("duplicate write intent is blocked", () =>
  fixture((root) => {
    const op = {
      action: "intent",
      kind: "create_pr",
      target: "refs/heads/fix/issue-1",
      taskId: "issue-1",
      key: "create-pr",
      sourceSha: head,
      artifact: "report.md",
    };
    const state = transition(through(root), op, root);
    assert.throws(() => transition(state, op, root), /reconcile/);
    assert.throws(
      () => transition(state, request("dev"), root),
      /Reconcile pending/,
    );
  }));
test("read-back cannot bind another repository", () =>
  fixture((root) => {
    const state = transition(
      through(root),
      {
        action: "intent",
        kind: "create_pr",
        target: "refs/heads/fix/issue-1",
        taskId: "issue-1",
        key: "pr",
        sourceSha: head,
        artifact: "report.md",
      },
      root,
    );
    assert.throws(
      () =>
        transition(
          state,
          {
            action: "reconcile",
            taskId: "issue-1",
            key: "pr",
            result: "APPLIED",
            remoteUrl: "https://github.com/openIndu/other/pull/1",
            artifact: "report.md",
          },
          root,
        ),
      /repository mismatch/,
    );
  }));
test("persistent lease excludes another run and supports resume", () =>
  fixture((root) => {
    execute(root, "openIndu/control-tower", { action: "start", runId: "one" });
    assert.throws(
      () =>
        execute(root, "openIndu/control-tower", {
          action: "start",
          runId: "two",
        }),
      /EEXIST/,
    );
    assert.throws(
      () =>
        execute(root, "openIndu/control-tower", {
          action: "inspect",
          runId: "two",
        }),
      /another run/,
    );
    const dir = join(root, "openindu/control-tower/tasks/issue-1");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "report.md"), "Research evidence");
    execute(root, "openIndu/control-tower", {
      ...request("research"),
      runId: "one",
    });
    assert.ok(
      execute(root, "openIndu/control-tower", {
        action: "inspect",
        runId: "one",
      }).tasks["issue-1"],
    );
    execute(root, "openIndu/control-tower", {
      action: "release",
      runId: "one",
    });
    execute(root, "openIndu/control-tower", { action: "start", runId: "two" });
  }));
test("non-openIndu scope rejected", () =>
  assert.throws(() => repository("other/project"), /Only openIndu/));
test("collector deduplicates pagination overlap", () => {
  const result = collectIssues([{ name: "repo" }], () => [
    { number: 1 },
    { number: 1 },
    { number: 2, pull_request: {} },
  ]);
  assert.equal(result.issues.length, 1);
});
function buildFixture(root) {
  const taskDir = join(root, "tasks/issue-1");
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, "report.md"), "Observed test evidence");
  const state = through(taskDir);
  const stateFile = join(root, "state.json");
  writeFileSync(stateFile, JSON.stringify(state));
  return {
    sourceSha: head,
    repo: "openIndu/control-tower",
    checkpoint: { stateFile, taskId: "issue-1" },
  };
}
test("tested checkout passes source check", () =>
  fixture((root) => {
    assert.equal(
      checkSource(".", buildFixture(root), (args) =>
        args[0] === "rev-parse" ? head : "",
      ).tag,
      head,
    );
  }));
for (const [label, answers] of [
  ["old checkout", [base, "", ""]],
  ["dirty checkout", [head, " M file", ""]],
  ["wrong submodule", [head, "", `+${base} module`]],
])
  test(`build blocks ${label}`, () =>
    fixture((root) => {
      let i = 0;
      assert.throws(() =>
        checkSource(".", buildFixture(root), () => answers[i++]),
      );
    }));
test("build rejects self-declared tests without checkpoint", () =>
  assert.throws(
    () =>
      checkSource(".", {
        sourceSha: head,
        test: { status: "PASS", sourceSha: head },
      }),
    /checkpoint required/,
  ));
test("build rejects mutated test evidence", () =>
  fixture((root) => {
    const manifest = buildFixture(root);
    writeFileSync(join(root, "tasks/issue-1/report.md"), "altered");
    assert.throws(
      () => checkSource(".", manifest, () => head),
      /evidence changed/,
    );
  }));
test("build rejects stale checkpoint SHA", () =>
  fixture((root) => {
    const manifest = buildFixture(root);
    manifest.sourceSha = base;
    assert.throws(
      () => checkSource(".", manifest, () => base),
      /match source SHA/,
    );
  }));
test("only immutable remote image accepted", () =>
  fixture((root) => {
    assert.throws(
      () =>
        transition(
          through(root),
          {
            action: "build",
            taskId: "issue-1",
            sourceSha: head,
            image: "registry/image:latest",
            artifact: "report.md",
          },
          root,
        ),
      /digest required/,
    );
  }));
test("eligible PR requires current independent human review", () =>
  assert.equal(assess(pr, required, [review], head, base).eligible, true));
for (const [label, patch] of [
  ["draft", { isDraft: true }],
  ["merged", { state: "MERGED" }],
  ["conflict", { mergeable: "CONFLICTING" }],
  ["unknown merge state", { mergeStateStatus: "UNKNOWN" }],
  ["new head", { headRefOid: base }],
  ["new base", { baseRefOid: head }],
  ["unapproved", { reviewDecision: "REVIEW_REQUIRED" }],
])
  test(`merge blocks ${label}`, () =>
    assert.equal(
      assess({ ...pr, ...patch }, required, [review], head, base).eligible,
      false,
    ));
for (const state of ["PENDING", "FAILURE", "SKIPPED", "CANCELLED", "NEUTRAL"])
  test(`required CI ${state} blocks merge`, () =>
    assert.equal(
      assess(pr, [{ state }], [review], head, base).eligible,
      false,
    ));
test("no required CI blocks merge", () =>
  assert.equal(assess(pr, [], [review], head, base).eligible, false));
for (const [label, patch] of [
  ["stale", { commit_id: base }],
  ["bot", { user: { login: "bot", type: "Bot" } }],
  ["self", { user: { login: "author", type: "User" } }],
  ["dismissed", { state: "DISMISSED" }],
])
  test(`${label} approval blocks merge`, () =>
    assert.equal(
      assess(pr, required, [{ ...review, ...patch }], head, base).eligible,
      false,
    ));
test("outstanding change request blocks merge", () =>
  assert.equal(
    assess(
      pr,
      required,
      [
        review,
        {
          ...review,
          id: 2,
          state: "CHANGES_REQUESTED",
          user: { login: "other", type: "User" },
        },
      ],
      head,
      base,
    ).eligible,
    false,
  ));
test("strict protection and base ref read back before eligibility", () => {
  const run = (args) =>
    JSON.stringify(
      args[0] === "pr"
        ? args[1] === "view"
          ? pr
          : required
        : args.at(-1).endsWith("/protection")
          ? { required_status_checks: { strict: true } }
          : args.at(-1).includes("/git/ref/")
            ? { object: { sha: base } }
            : [[review]],
    );
  assert.equal(
    inspect("openIndu/control-tower", 1, head, base, run).eligible,
    true,
  );
  assert.throws(
    () =>
      inspect("openIndu/control-tower", 1, head, base, (args) =>
        args.at(-1).endsWith("/protection") ? "{}" : run(args),
      ),
    /Strict/,
  );
});

test("changing operation key cannot replay uncertain write", () =>
  fixture((root) => {
    const op = {
      action: "intent",
      taskId: "issue-1",
      key: "pr-one",
      kind: "create_pr",
      target: "refs/heads/fix/issue-1",
      sourceSha: head,
      artifact: "report.md",
    };
    let state = transition(through(root), op, root);
    assert.throws(
      () => transition(state, { ...op, key: "pr-two" }, root),
      /Existing target/,
    );
    state = transition(
      state,
      {
        action: "reconcile",
        taskId: "issue-1",
        key: "pr-one",
        result: "BLOCKED",
        remoteUrl: "https://github.com/openIndu/control-tower",
        artifact: "report.md",
      },
      root,
    );
    assert.throws(
      () => transition(state, { ...op, key: "pr-two" }, root),
      /Existing target/,
    );
    assert.throws(
      () => transition(state, request("dev"), root),
      /Reconcile pending/,
    );
    state = transition(
      state,
      {
        action: "reconcile",
        taskId: "issue-1",
        key: "pr-one",
        result: "NOT_APPLIED",
        remoteUrl: "https://github.com/openIndu/control-tower",
        artifact: "report.md",
      },
      root,
    );
    assert.equal(
      transition(state, { ...op, key: "pr-two" }, root).tasks["issue-1"]
        .operations["pr-two"].state,
      "PENDING",
    );
  }));
test("applied push reconciles independently of PR", () =>
  fixture((root) => {
    const state = transition(
      through(root),
      {
        action: "intent",
        taskId: "issue-1",
        key: "push",
        kind: "push",
        target: "refs/heads/fix/issue-1",
        sourceSha: head,
        artifact: "report.md",
      },
      root,
    );
    const readback = {
      action: "reconcile",
      taskId: "issue-1",
      key: "push",
      result: "APPLIED",
      remoteUrl: `https://github.com/openIndu/control-tower/commit/${head}`,
      observedSha: head,
      artifact: "report.md",
    };
    assert.throws(
      () => transition(state, { ...readback, observedSha: base }, root),
      /source SHA mismatch/,
    );
    assert.equal(
      transition(state, readback, root).tasks["issue-1"].operations.push.state,
      "APPLIED",
    );
  }));
test("directory junction cannot escape task artifacts", () =>
  fixture((root) => {
    const taskDir = join(root, "task");
    mkdirSync(taskDir);
    const outside = join(root, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "report.md"), "External");
    symlinkSync(outside, join(taskDir, "link"), "junction");
    assert.throws(
      () =>
        transition(
          { tasks: {} },
          request("research", { artifact: "link/report.md" }),
          taskDir,
        ),
      /escapes task/,
    );
  }));
test("failed required checks retain individual diagnostics", () => {
  const run = (args) => {
    if (args[1] === "checks")
      throw Object.assign(new Error("Checks failed"), {
        status: 1,
        stdout: JSON.stringify([{ name: "integration", state: "FAILURE" }]),
      });
    return JSON.stringify(
      args[0] === "pr"
        ? pr
        : args.at(-1).endsWith("/protection")
          ? { required_status_checks: { strict: true } }
          : args.at(-1).includes("/git/ref/")
            ? { object: { sha: base } }
            : [[review]],
    );
  };
  const result = inspect("openIndu/control-tower", 1, head, base, run);
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes("Required check integration: FAILURE"));
});

test("source helper verifies a real Git checkout and detects later edits", () =>
  fixture((root) => {
    const source = join(root, "source");
    mkdirSync(source);
    const git = (args) =>
      execFileSync("git", args, {
        cwd: source,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    git(["init", "-b", "main"]);
    writeFileSync(join(source, "source.txt"), "Tested source");
    git(["add", "source.txt"]);
    git([
      "-c",
      "user.name=Workflow Test",
      "-c",
      "user.email=workflow-test@example.invalid",
      "commit",
      "-m",
      "fixture",
    ]);
    const actual = git(["rev-parse", "HEAD"]),
      manifest = buildFixture(root);
    const taskDir = join(root, "tasks/issue-1");
    let state = through(taskDir, "prod");
    state = transition(state, request("dev", { sourceSha: actual }), taskDir);
    state = transition(state, request("test", { sourceSha: actual }), taskDir);
    writeFileSync(manifest.checkpoint.stateFile, JSON.stringify(state));
    manifest.sourceSha = actual;
    assert.equal(checkSource(source, manifest).sourceSha, actual);
    writeFileSync(join(source, "source.txt"), "Untested edit");
    assert.throws(() => checkSource(source, manifest), /dirty/);
  }));

test("two tasks with the same report filename retain isolated evidence", () =>
  fixture((root) => {
    execute(root, "openIndu/control-tower", {
      action: "start",
      runId: "isolation",
    });
    for (const id of ["issue-1", "issue-2"]) {
      const directory = join(root, "openindu/control-tower/tasks", id);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "report.md"), `Evidence for ${id}`);
      execute(root, "openIndu/control-tower", {
        ...request("research"),
        taskId: id,
        runId: "isolation",
      });
    }
    const state = execute(root, "openIndu/control-tower", {
      action: "inspect",
      runId: "isolation",
    });
    assert.notEqual(
      state.tasks["issue-1"].stages.research.evidence.sha256,
      state.tasks["issue-2"].stages.research.evidence.sha256,
    );
  }));

test("base change during inspection blocks even with earlier green checks", () => {
  let baseReads = 0;
  const run = (args) =>
    JSON.stringify(
      args[0] === "pr"
        ? args[1] === "view"
          ? pr
          : required
        : args.at(-1).endsWith("/protection")
          ? { required_status_checks: { strict: true } }
          : args.at(-1).includes("/git/ref/")
            ? { object: { sha: ++baseReads === 1 ? base : head } }
            : [[review]],
    );
  assert.throws(
    () => inspect("openIndu/control-tower", 1, head, base, run),
    /changed during/,
  );
});

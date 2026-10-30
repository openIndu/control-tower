import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateBuildReadiness,
  renderRule11StatusChecklist,
  runBuildStep,
} from "./build-step.mjs";

test("evaluateBuildReadiness reports N/A when dev.build is null", () => {
  const result = evaluateBuildReadiness(null, {});
  assert.equal(result.status, "N/A");
});

test("evaluateBuildReadiness reports PENDING when an aggregate-routed build has not had its submodule pointer PR merged", () => {
  const result = evaluateBuildReadiness(
    { aggregate: true, note: "openIndu-platform" },
    { submodulePointerMerged: false },
  );
  assert.equal(result.status, "PENDING");
  assert.match(result.reason, /RULE 11/);
});

test("evaluateBuildReadiness reports READY_TO_BUILD when an aggregate-routed build's submodule pointer PR has merged", () => {
  const result = evaluateBuildReadiness(
    { aggregate: true, note: "openIndu-platform" },
    { submodulePointerMerged: true },
  );
  assert.equal(result.status, "READY_TO_BUILD");
});

test("evaluateBuildReadiness reports READY_TO_BUILD for a non-aggregate build regardless of rule11Status", () => {
  const result = evaluateBuildReadiness(
    { aggregate: false, note: "standalone release" },
    {},
  );
  assert.equal(result.status, "READY_TO_BUILD");
});

test("runBuildStep short-circuits on N/A without calling runAggregateRelease", async () => {
  let called = false;
  const result = await runBuildStep(
    {
      repoName: "studio",
      devBuildConfig: null,
      rule11Status: {},
      userConfirmed: true,
    },
    {
      runAggregateRelease: async () => {
        called = true;
        return { imageTag: "x" };
      },
    },
  );
  assert.equal(result.status, "N/A");
  assert.equal(called, false);
});

test("runBuildStep short-circuits on PENDING without calling runAggregateRelease", async () => {
  let called = false;
  const result = await runBuildStep(
    {
      repoName: "backend",
      devBuildConfig: { aggregate: true },
      rule11Status: { submodulePointerMerged: false },
      userConfirmed: true,
    },
    {
      runAggregateRelease: async () => {
        called = true;
        return { imageTag: "x" };
      },
    },
  );
  assert.equal(result.status, "PENDING");
  assert.equal(called, false);
});

test("runBuildStep reports AWAITING_CONFIRMATION and never builds when the user has not confirmed", async () => {
  let called = false;
  const result = await runBuildStep(
    {
      repoName: "backend",
      devBuildConfig: { aggregate: true },
      rule11Status: { submodulePointerMerged: true },
      userConfirmed: false,
    },
    {
      runAggregateRelease: async () => {
        called = true;
        return { imageTag: "x" };
      },
    },
  );
  assert.equal(result.status, "AWAITING_CONFIRMATION");
  assert.equal(called, false);
});

test("runBuildStep calls runAggregateRelease and reports BUILT with the image tag once ready and confirmed", async () => {
  const result = await runBuildStep(
    {
      repoName: "backend",
      devBuildConfig: { aggregate: true },
      rule11Status: { submodulePointerMerged: true },
      userConfirmed: true,
    },
    {
      runAggregateRelease: async ({ repoName }) => ({
        imageTag: `${repoName}:abc1234`,
      }),
    },
  );
  assert.equal(result.status, "BUILT");
  assert.equal(result.imageTag, "backend:abc1234");
});

test("runBuildStep throws before doing anything if a credential-shaped field is present anywhere in its inputs", async () => {
  let called = false;
  await assert.rejects(
    () =>
      runBuildStep(
        {
          repoName: "backend",
          devBuildConfig: {
            aggregate: false,
            registryToken: "should-never-be-here",
          },
          rule11Status: {},
          userConfirmed: true,
        },
        {
          runAggregateRelease: async () => {
            called = true;
            return { imageTag: "x" };
          },
        },
      ),
    /credential/,
  );
  assert.equal(called, false);
});

test("renderRule11StatusChecklist renders a checkbox per RULE 11 step with done/pending marks", () => {
  const markdown = renderRule11StatusChecklist([
    { step: "③", label: "子模块指针 PR", status: "done" },
    { step: "④", label: "镜像构建推送", status: "pending" },
  ]);
  assert.match(markdown, /- \[x\] ③ 子模块指针 PR/);
  assert.match(markdown, /- \[ \] ④ 镜像构建推送/);
});

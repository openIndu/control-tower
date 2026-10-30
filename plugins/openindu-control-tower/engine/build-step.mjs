// spec/005 section 2.1 step 6 (`./dev build <repo>`): NOT part of the automatic
// 6-step pipeline -- a separate subcommand that only runs after explicit user
// confirmation, and the runner never holds image-registry credentials (the user
// runs `docker login` themselves). This module computes readiness and renders the
// RULE 11 status report; it does not build or push anything itself. When a repo's
// dev.build points at an aggregate repo's own /release, actually running that
// release flow is delegated to an injected callback -- that mechanism lives in the
// aggregate repo, out of scope for control-tower.

const CREDENTIAL_LIKE_KEYS = /token|password|credential|apikey|api_key|secret/i;

// Tripwire for "runner 不持有镜像仓库凭据": if anything credential-shaped ever
// gets plumbed into this call, fail loudly rather than silently accepting it.
function assertNoCredentialLikeFields(obj, path = "options") {
  if (obj === null || typeof obj !== "object") return;
  for (const [key, value] of Object.entries(obj)) {
    if (CREDENTIAL_LIKE_KEYS.test(key)) {
      throw new Error(
        `refusing to proceed -- ${path}.${key} looks like a credential; the build-step runner must never hold registry credentials`,
      );
    }
    assertNoCredentialLikeFields(value, `${path}.${key}`);
  }
}

export function evaluateBuildReadiness(devBuildConfig, rule11Status) {
  if (devBuildConfig == null) {
    return {
      status: "N/A",
      reason:
        "this repo has no established image-publish pipeline (dev.build is null)",
    };
  }
  if (devBuildConfig.aggregate && !rule11Status?.submodulePointerMerged) {
    return {
      status: "PENDING",
      reason: "RULE 11 step ③ (submodule pointer PR) has not merged yet",
    };
  }
  return { status: "READY_TO_BUILD" };
}

export async function runBuildStep(
  { repoName, devBuildConfig, rule11Status, userConfirmed },
  { runAggregateRelease },
) {
  assertNoCredentialLikeFields({ devBuildConfig, rule11Status });

  const readiness = evaluateBuildReadiness(devBuildConfig, rule11Status);
  if (readiness.status !== "READY_TO_BUILD") {
    return { ...readiness, repoName };
  }
  if (!userConfirmed) {
    return {
      status: "AWAITING_CONFIRMATION",
      repoName,
      reason: "step 6 only runs after explicit user confirmation",
    };
  }

  const result = await runAggregateRelease({ repoName, devBuildConfig });
  return { status: "BUILT", repoName, imageTag: result.imageTag };
}

// entries: [{ step: "③", label: "...", status: "done" | "pending" }, ...]
export function renderRule11StatusChecklist(entries) {
  const lines = ["# RULE 11 delivery status", ""];
  for (const entry of entries) {
    const mark = entry.status === "done" ? "x" : " ";
    lines.push(`- [${mark}] ${entry.step} ${entry.label}`);
  }
  return lines.join("\n");
}

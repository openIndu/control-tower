import {
  checkForRollbackAndPause,
  evaluateCircuitBreakerAfterMerge,
} from "./merge-execute.mjs";
import {
  evaluatePostPromotionRecheck,
  evaluatePromotionReadiness,
  runCiRetryLoop,
} from "./pr-lifecycle.mjs";

// spec/005 section 2.1 step 4, the full sequence: commit+push -> open draft PR ->
// CI (retrying fixes up to 2x) -> pre-promotion guards -> promote to ready ->
// post-promotion recheck -> merge -> readback -> circuit-breaker/rollback checks.
// Every side-effecting action (commitAndPush, openPr, pollChecks, promote, merge,
// readBack) and every fact-gathering call is injected -- this module owns only the
// SEQUENCE and the outcome decision tree, calling the already-built guard/circuit-
// breaker functions from E3/E4 rather than re-deciding anything they already decide.
//
// resumeState (shaped like run-state.mjs's per-issue entry: {openedPr, prNumber,
// promotedToReady, merged, mergeSha}) makes each step idempotent for --resume: a
// step already recorded as done is skipped rather than redone, per spec/005's "每步
// 幂等（不重复开 PR、不重复合并）". This module does not import run-state.mjs or
// persist anything itself -- the caller applies the returned outcome to run-state
// and saves it; keeping persistence out of here keeps this module a pure sequencer.
export async function runStep4(
  { resumeState = {}, pauseFilePath, stopAfterCiGreen = false },
  {
    commitAndPush,
    openPr,
    pollChecks,
    attemptCiFix,
    gatherPromotionFacts,
    promote,
    gatherPostPromotionFacts,
    merge,
    readBack,
    gatherCircuitBreakerFacts,
    gatherRollbackFacts,
  },
) {
  if (!resumeState.openedPr) {
    await commitAndPush();
  }

  const prNumber = resumeState.openedPr
    ? resumeState.prNumber
    : (await openPr()).prNumber;

  // --no-merge (spec/005 section 2.1's control switches): stop once CI is
  // green, never touch promotion/merge at all. A resumed run that already
  // merged under an earlier invocation that did not pass --no-merge still
  // finishes the readback/circuit-breaker tail below -- stopAfterCiGreen
  // only short-circuits the not-yet-merged path, it does not undo a merge
  // that already happened.
  if (stopAfterCiGreen && !resumeState.merged) {
    const ciResult = await runCiRetryLoop({
      checkCi: async () => {
        const { settled, checks } = await pollChecks(prNumber);
        return {
          green: settled && checks.every((c) => c.conclusion === "SUCCESS"),
        };
      },
      attemptFix: attemptCiFix,
    });
    if (ciResult.outcome !== "green") {
      return {
        outcome: "HUMAN_MERGE_REQUIRED",
        prNumber,
        reason: `CI did not turn green after ${ciResult.attempts} fix attempt(s)`,
      };
    }
    return { outcome: "PR_GREEN", prNumber };
  }

  if (!resumeState.merged) {
    const ciResult = await runCiRetryLoop({
      checkCi: async () => {
        const { settled, checks } = await pollChecks(prNumber);
        return {
          green: settled && checks.every((c) => c.conclusion === "SUCCESS"),
        };
      },
      attemptFix: attemptCiFix,
    });
    if (ciResult.outcome !== "green") {
      return {
        outcome: "HUMAN_MERGE_REQUIRED",
        prNumber,
        reason: `CI did not turn green after ${ciResult.attempts} fix attempt(s)`,
      };
    }

    if (!resumeState.promotedToReady) {
      const promotionFacts = await gatherPromotionFacts(prNumber);
      const promotionResult = evaluatePromotionReadiness(promotionFacts);
      if (!promotionResult.allPass) {
        return {
          outcome: "HUMAN_MERGE_REQUIRED",
          prNumber,
          failures: promotionResult.failures,
        };
      }
      await promote(prNumber);
    }

    const postFacts = await gatherPostPromotionFacts(prNumber);
    const postResult = evaluatePostPromotionRecheck(postFacts);
    if (!postResult.allPass) {
      return {
        outcome: "HUMAN_MERGE_REQUIRED",
        prNumber,
        failures: postResult.failures,
      };
    }

    await merge(prNumber);
  }

  const readBackResult = await readBack(prNumber);
  if (!readBackResult.merged) {
    return {
      outcome: "FAILED",
      prNumber,
      reason: "merge did not take effect per readback",
    };
  }

  const cbFacts = await gatherCircuitBreakerFacts();
  const cbVerdict = evaluateCircuitBreakerAfterMerge(cbFacts, pauseFilePath);
  const rollbackFacts = await gatherRollbackFacts();
  const rollbackDetected = checkForRollbackAndPause(
    rollbackFacts,
    pauseFilePath,
  );

  return {
    outcome: "MERGED",
    prNumber,
    mergeCommit: readBackResult.mergeCommit,
    circuitBreakerTripped: cbVerdict.tripped,
    rollbackDetected: rollbackDetected.length > 0,
  };
}

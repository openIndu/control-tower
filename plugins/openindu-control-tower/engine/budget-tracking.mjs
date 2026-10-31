// spec/005 section 2.6: "--max-budget-usd 约束单次调用，runner 另管单次运行总预算" --
// carrier-callbacks.mjs's parseStructuredResponse (and buildRealImplement/
// buildRealFix's already-full invoke result) carry each call's actual costUsd;
// this module is the runner-side half that sums it across a whole /dev run and
// decides when the cap is reached. Deliberately kept out of proposal-review.mjs/
// implement-review.mjs/tier-resolution.mjs -- those modules' callback contracts
// (generateProposal -> {summary}, reviewProposal -> {score, mustFix}, etc.) stay
// unchanged; this wraps a callback from the *outside*, at the dependency-
// injection boundary where dev.mjs's main() builds the real callbacks.

export function createBudgetTracker(maxTotalUsd) {
  let spentUsd = 0;
  return {
    addCost(costUsd) {
      if (typeof costUsd === "number" && Number.isFinite(costUsd)) {
        spentUsd += costUsd;
      }
    },
    get spentUsd() {
      return spentUsd;
    },
    get exceeded() {
      return maxTotalUsd != null && spentUsd >= maxTotalUsd;
    },
  };
}

// Wraps any async carrier callback so a successful call's costUsd (when it is
// a number -- null/undefined/absent, e.g. a bare fake with no cost modeled,
// or buildRealSummarizeAcceptanceCriteria's unwrapped array return, is simply
// not counted) is reported to addCost before the result is returned unchanged.
export function withCostTracking(fn, addCost) {
  return async (...args) => {
    const result = await fn(...args);
    if (result && typeof result.costUsd === "number") {
      addCost(result.costUsd);
    }
    return result;
  };
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { withCostTracking } from "./budget-tracking.mjs";
import {
  buildRealFix,
  buildRealGenerateProposal,
  buildRealGenerateScopingProposal,
  buildRealImplement,
  buildRealReviewImplementation,
  buildRealReviewProposal,
  buildSystemPromptText,
} from "./carrier-callbacks.mjs";
import { withTraceLogging } from "./trace-log.mjs";

const PRINCIPLE_SKILL_MD_RELATIVE_PATH =
  "plugins/openindu-control-tower/skills/principle/SKILL.md";

function readTextFileOrNull(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

// One system prompt is shared across every issue and every carrier call in
// a run -- the principle text and the target repo's CLAUDE.md/AGENTS.md do
// not change mid-run, so this is called once per run, not once per issue.
export function setupSystemPrompt(
  { controlTowerRepoPath, repoClonePath, promptDir },
  { readTextFile = readTextFileOrNull } = {},
) {
  const principleText = readTextFile(
    join(controlTowerRepoPath, PRINCIPLE_SKILL_MD_RELATIVE_PATH),
  );
  if (principleText === null) {
    throw new Error(
      `could not read the principle SKILL.md from ${controlTowerRepoPath} -- RULE 1 requires it, refusing to proceed without it`,
    );
  }
  const text = buildSystemPromptText({
    principleText,
    repoClaudeMd: readTextFile(join(repoClonePath, "CLAUDE.md")),
    repoAgentsMd: readTextFile(join(repoClonePath, "AGENTS.md")),
  });
  mkdirSync(promptDir, { recursive: true });
  const path = join(promptDir, "system-prompt.txt");
  writeFileSync(path, text);
  return path;
}

// All 6 per-issue carrier callbacks runIssuePipeline's third parameter
// needs, built from the one shared context shape every buildReal* function
// in carrier-callbacks.mjs already takes ({worktreePath,
// systemPromptFilePath, promptDir, allowedToolCommands, maxBudgetUsd}).
// execShell is deliberately omitted -- implement-review.mjs's own
// defaultExecShell already covers it; threading a redundant pass-through
// here would be more code for zero behavior change.
export function buildCarrierCallbacks(context, overrides = {}) {
  return {
    generateScopingProposal: buildRealGenerateScopingProposal(
      context,
      overrides,
    ),
    generateProposal: buildRealGenerateProposal(context, overrides),
    reviewProposal: buildRealReviewProposal(context, overrides),
    implement: buildRealImplement(context, overrides),
    reviewImplementation: buildRealReviewImplementation(context, overrides),
    fix: buildRealFix(context, overrides),
  };
}

// Wraps every callback in a buildCarrierCallbacks() result with
// budget-tracking.mjs's withCostTracking and trace-log.mjs's
// withTraceLogging -- both modules' own comments describe wrapping a
// callback "from the outside" at exactly this dependency-injection
// boundary, so this composes the two rather than making main()'s loop
// re-apply both wrappers to each of the 6 keys by hand. The callback's own
// key (generateProposal, implement, etc.) is used as the trace label --
// the trace file itself is already scoped per issue (trace-log.mjs's
// traceFileName), so the label only needs to distinguish which callback
// within that one file, not which issue.
export function withTrackingWrappers(callbacks, { addCost, appendTrace }) {
  const wrapped = {};
  for (const [name, fn] of Object.entries(callbacks)) {
    wrapped[name] = withTraceLogging(
      withCostTracking(fn, addCost),
      appendTrace,
      name,
    );
  }
  return wrapped;
}

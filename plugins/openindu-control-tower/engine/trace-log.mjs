import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { redactSecrets } from "./log-redaction.mjs";

// spec/005 section 6 criterion #16: "持久化带脱敏的 stream-json 轨迹" (persist a
// redacted stream-json trace). invokeAgent (carrier/run-agent.mjs) now returns
// the call's raw stdout alongside the already-parsed result; this module is
// where that raw trace gets redacted and written to disk. Unlike docs-dir.mjs's
// solution/review documents (written exactly once per issue, RULE 6 refuses a
// second write), a trace accumulates one entry per carrier call within an
// issue's lifecycle -- scoping, each proposal, each review round, implement,
// fix, CI-fix retries -- so this appends rather than refusing to overwrite.

export function traceFileName(issueNumber) {
  return `issue-${issueNumber}-trace.jsonl`;
}

export function appendTraceEntry(
  docsDir,
  fileName,
  { label, rawStdout },
  redact = redactSecrets,
) {
  const path = join(docsDir, fileName);
  mkdirSync(docsDir, { recursive: true });
  const entry = JSON.stringify({
    label,
    at: new Date().toISOString(),
    stdout: redact(rawStdout ?? ""),
  });
  appendFileSync(path, entry + "\n");
  return path;
}

// Wraps any real carrier callback (buildRealGenerateProposal, etc.) so a
// result carrying a rawStdout string gets appended to the trace file before
// the result is returned unchanged. A bare test fake with no rawStdout field
// is simply not logged, same non-invasive shape as budget-tracking.mjs's
// withCostTracking, which this is meant to compose alongside (both wrap the
// same real invoke result from the outside, at dev.mjs's main()).
export function withTraceLogging(fn, appendTrace, label) {
  return async (...args) => {
    const result = await fn(...args);
    if (result && typeof result.rawStdout === "string") {
      appendTrace({ label, rawStdout: result.rawStdout });
    }
    return result;
  };
}

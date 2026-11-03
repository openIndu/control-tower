# Workflow execution contract v1

This contract applies to `/research`, `/prod`, `/dev`, `/test`, `/dev_issue`,
`/design`, `/autopilot`, `/issue-pipeline`, `/build`, `/publish` and `/pr_merge`.
Load `/principle`; this contract grants no merge/deploy authority.

## Task identity and artifacts

Use one durable state root outside disposable worktrees (the workspace `memory/workflow-runs`
directory). Canonical identity is `openindu/<repo>/<task-id>`; use `issue-<number>`
for Issues. Never derive paths or commands directly from Issue titles/bodies.
Artifacts live under `<state-root>/openindu/<repo>/tasks/<task-id>/`.
Each stage writes a new versioned artifact; never overwrite completed artifacts.
The state file records paths and SHA-256 hashes. Product and downstream roles
receive the exact task ID and artifact path, never a shared "latest" report.

## Stage gates

Every task records these in order:

| Stage    | Required evidence                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| research | Competitors, released features versus public roadmap, sources/date, our current capabilities, differentiation hypotheses and actions; go/pivot/stop decision |
| prod     | Named research input, scope, MVP, dependencies, acceptance matrix and open blockers                                                                          |
| dev      | Requirement mapping, diff summary, full source commit SHA, self-review                                                                                       |
| test     | Same source SHA, UT/IT commands and exit codes, local startup/ports/health, interactive acceptance results with screenshots/API evidence, cleanup            |

`research`/`prod` may record `NA` only with explicit applicability reasoning and
evidence (for example an existing confirmed requirement for a typo correction).
Development and test cannot be skipped. Missing environment or manual validation
means BLOCKED, never PASS. Rerunning a stage invalidates every later stage/build;
source changes require new tests. Research rejection or unresolved PRD blockers
must be resolved before recording PASS. The script validates structure/order and
artifact integrity; the agent and reviewers judge evidence quality.

## Durable execution

Use `node <plugin-root>/skills/issue-pipeline/scripts/workflow-state.mjs <state-root> <openIndu/repo> <request.json>`.
All requests contain `runId`. Start with `{"runId":"run-20261103-1","action":"start"}`.
Only one run owns a repository lease; no timeout automatically steals it. To
resume, use the recorded run ID and `action: "inspect"`. Verify the prior worker
has stopped before resuming. A stale checkpoint.lock requires operator inspection
of the state and remote effects before removal, never automatic lock deletion.

Stage request example:

```json
{
  "runId": "run-20261103-1",
  "action": "stage",
  "taskId": "issue-123",
  "stage": "research",
  "decision": "CONTINUE",
  "status": "PASS",
  "reason": "Evidence supports the scoped change",
  "artifact": "research-v1.md"
}
```

For prod PASS also supply `blockers: []` and positive `acceptanceCount`.
For dev/test also supply full `sourceSha`. Test requests require `checks` keyed
by `UT`, `IT`, `LOCAL`, `MANUAL`, `CLEANUP`; each has `status: "PASS"` and a
nonempty `evidence` description referring to results in the hashed report. Read the resulting state after each
checkpoint. Keep state and evidence out of source commits and credential logs.

Before push/PR creation, reread Issue status, requirements, branch head and all
existing open/closed PRs for that Issue/branch. Reuse the existing PR; a closed
unmerged PR requires explicit disposition. Query failure blocks the write.
Write `action: "intent"` with taskId, unique attempt `key`, `kind` (`push` or `create_pr`), branch `target`
(`refs/heads/fix/issue-123`), sourceSha and an
artifact describing the exact expected write. Existing keys block replay. A different key cannot bypass an unresolved
PENDING/BLOCKED operation for the same kind/target. An existing applied PR is reused.
After the call (including errors), read GitHub and use `action: "reconcile"` with
key, result (`APPLIED`, `NOT_APPLIED`, `BLOCKED`), remoteUrl and read-back artifact.
For an applied push, use its remote branch/commit URL; for an applied PR use
its PR URL. APPLIED also requires `observedSha` matching the intent. For confirmed
absence or uncertain effects, use the repository URL and preserve query evidence. Confirmed absence permits a new explicitly logged operation key;
never reuse an uncertain intent. Pending or blocked writes prevent stage reruns. Historical
write records survive evidence invalidation. Release using `action: "release"`
only once the journal is persisted; retain blocked state for the next run.

Merge writes use the separate per-PR journal specified by `/pr_merge`; issue
stage completion does not authorize merging or production publishing.

---
name: issue-verify-loop
description: Lightweight loop for one repository's open Issues — collect (PR #20 engine) → develop per issue (red-green, local gates) → dispatch /session-verify per fix → green PRs with re-inspection receipts. No leases/checkpoints (heavy machinery = /dev_issue).
argument-hint: "<openIndu/repo> [--issue <n>] [--max <count>]"
disable-model-invocation: true
---

# /issue-verify-loop — collect → develop → cross-session verify

Call `/principle` first (RULE 1). This skill owns the lightweight orchestration
of one repository's issue batch: **collect → per-issue develop → per-fix
cross-session verify → receipts**. It composes three existing pieces and adds
only the sequencing:

1. **collect** — the PR #20 engine: `skills/issue-pipeline/scripts/collect-org-issues.mjs`
   (issue-pipeline skill), no new collection code;
2. **develop** — the lightweight per-fix pattern (below), or route to the
   production-safety SQL template / infra-deploy flow for data-landing and
   manifest-only issues;
3. **verify** — delegates each fix to `/session-verify` (spec/014): independence
   rules, brief generation, findings routing are that skill's contract; this
   loop sequences and relays only.

## Boundary

Lightweight = no leases, no checkpoints, no workflow state files (that is
`/dev_issue`'s heavy machinery). Same-session development; the cross-session
part is verification only. Batch cap `--max` defaults to 3 (the 2026-11-23
batch ran seven; the rework tail is the cost of wide batches).

## Phase 1 — Collect

```bash
node <plugin-root>/skills/issue-pipeline/scripts/collect-org-issues.mjs \
  --org openIndu --repo <route-repo-name> --state open
```

Require `complete: true`. PRs excluded. Read every Issue's body and ALL
comments (acceptance revisions and owner verdicts live in the last comment).

## Phase 2 — Select

Present the collected list (number / title / comments) and let the owner pick,
or honor `--issue <n>`. Cap the batch at `--max`. Record the selection and the
reason each excluded issue was deferred — the batch summary is never a blanket
"all done".

## Phase 3 — Per-issue develop (serial)

For each selected issue, in dependency order:

1. Branch from origin/main (`fix/<n>-<slug>` / `feat/<n>-<slug>`); never stack
   on a previous batch branch.
2. Recon first: map every issue claim to `file:line`, check the local stack /
   live endpoints, read the DB state — before writing anything.
3. Red-green: write the test against the unfixed code, confirm red, fix, confirm
   green. No test = no fix (data-landing and manifest-only changes exempt, but
   they route to their own safety templates).
4. Local gates with test-count accounting: pytest / vitest / tsc -b / ruff /
   check-workflow-docs (control-tower). Compare test counts before/after —
   lost content often passes syntax.
5. Commit via message-file template (`-F`), never inline `-m`; attribution per
   repo rules.
6. Route non-code changes: production SQL → production-safety template
   (owner executes); infra-deploy manifests → Gitee release flow.

## Phase 4 — Per-fix verify

After each fix passes local gates, dispatch `/session-verify <repo>
<merge-commit-or-PR-ref> <issue-number>` with the independence rules (author
session excluded; peer Claude session preferred, reviewer agent fallback;
worktree isolation; read-only). Relay findings:

- critical/major → rework in this loop (do not proceed to the next issue
  until the verdict is clean);
- clean → PR + receipt comment on the issue.

## Phase 5 — Batch receipts

End the loop with a per-issue status summary: merged / awaiting review /
rework / owner-side pending. Post the batch receipt (per-issue PR links +
re-inspection verdicts) to the tracked issue or the batch's tracking comment.
Never collapse the statuses into one blanket claim.

## Embedded pitfalls

Each of these cost a real cycle in the validating batch (2026-11-23/24) — the
full set lives in the workspace's dev-verification-traps memory:

- pipe-then-`$?` reports the pipe's exit code, not the gate's (`set -o pipefail`);
- `docker exec` heredoc without `-i` silently runs zero statements;
- `git archive HEAD:` exports the COMMITTED tree — commit before building;
  backend image CMD is web-api:8004 — override for MCP container tests;
- conflict fusion: compare test counts before/after (lost describes pass syntax);
- shared checkouts: verify branch + status before touching; coordinate by
  message across sessions;
- console mojibake ≠ content corruption — verify bytes before rewriting;
- SPA route components live in lazy chunks — grep the whole assets directory.

## Related

- `/session-verify` (spec/014) — the verification dispatch this loop calls.
- `/dev_issue` — heavy machinery (leases/checkpoints) for batches that need it.
- PR #20 — the collection engine this loop reuses.
- spec/015 — this loop's governance record.

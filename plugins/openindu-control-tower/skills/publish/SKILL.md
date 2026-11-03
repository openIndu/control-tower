---
name: publish
description: Prepare a verified image release as an English infra-deploy Gitee PR, with an independent repository lease, durable publication journal, remote read-back and rollback plan.
argument-hint: "<openIndu/repo> <task-id> [--dry-run]"
disable-model-invocation: true
---

# /publish — Publish through infra-deploy

Call `/principle` and `/route`. Load the release role. REASON: choose the exact
manifest delta and rollback. EXECUTE: verify build evidence, edit the GitOps
branch, submit its PR and read it back. Production apply remains human-only.

## Product evidence and target

Run `skills/issue-pipeline/scripts/workflow-request.mjs <request.json>` under the
plugin root with `command: "publish"`, source repo/task/run IDs, `checkpointFile`,
`sourceSha`, immutable `image` digest and boolean `dryRun`. It must verify all
four stages, registry evidence and the matching build checkpoint. Resolve the
authoritative target to Gitee `openIndu/infra-deploy`; no other target is allowed.
Read the registry again and verify the immutable digest and applicable platforms.
Missing registry/manifest mapping means BLOCKED, not an invented deployment.

Dry-run shows the exact manifest diff, target branch, English PR description,
expected fields and rollback plan. It creates no lease, journal, commit, push,
PR, merge or cluster change.

## GitOps PR and independent journal

Keep product evidence in its source task. Reuse/acquire its lease and acquire a
separate `openIndu/infra-deploy` lease through `workflow-state.mjs`. Acquire new
leases in canonical repo order; stop on contention rather than waiting while
holding an incompatible lease. Never steal a paused run's lease.

1. Read infra-deploy's current branch, AGENTS.md, target manifest and existing
   release PRs. Display target files, source/digest, expected manifest values,
   risk and rollback. Apply existing explicit authorization; obtain only any
   missing approval required by `/principle`. Never put credentials in commands.
2. Use `release/YYYYMMDD-task` with only the intended manifest delta; pin the
   immutable image digest, validate syntax/diff and commit locally. Preserve
   production manifests exclusively in infra-deploy.
3. Before push/PR creation, write an intent with:

   ```text
   node <plugin-root>/skills/publish/scripts/publish-journal.mjs <state-root> <request.json>
   ```

   Fields: `runId`, `action: "intent"`, unique attempt `key`, sourceRepo/taskId,
   product `sourceSha`, infra branch `headSha`, intended release `branch`, Gitee
   default `baseBranch` and its full `baseSha`, immutable `image`, and hashed
   `artifact` relative to the infra-deploy state directory. Read the current
   default branch from Gitee immediately before creating the intent. Query existing
   PRs/branch effects first and reuse a matching publication. The journal rejects
   replay under another key. Do not use the GitHub task reconciler for Gitee URLs.

4. Push the release branch, then create the PR with the authenticated Gitee CLI.
   Do not create it with a raw API request or by extracting Git credentials.

   - Record `gitee --version` in the task trace. Run `gitee auth status`; if the CLI is not authenticated, record BLOCKED and
     ask the user to sign in with `gitee auth login`. Never run `gitee auth token`
     or print, copy, or store the credential.
   - Read `gitee repo view openIndu/infra-deploy --json`. Parse the full JSON
     response to verify the target repository, PR capability, write permission,
     and current default branch. Use bare `--json`; the field-projection form
     `--json=field1,field2` returned empty objects with the locally verified CLI
     v0.3.3.
     The default branch must match the journal's `baseBranch`. Read the branch
     object with `gitee api /repos/openIndu/infra-deploy/branches/<baseBranch> -p`
     and verify its `commit.sha` matches the journal's `baseSha` immediately before
     creating the PR.
   - Query `gitee pr list --repo openIndu/infra-deploy --state open --head <branch> --base <baseBranch> --json`.
     Reuse an existing PR only after reading it back and confirming its branch,
     base, source SHA, manifest diff, and image. If the same branch points to
     different content or the state is ambiguous, record BLOCKED; do not create a
     duplicate.
   - Prepare a fully English title and body, then run:

     ```text
     gitee pr create --repo openIndu/infra-deploy --base "$baseBranch" --head "$branch" --title "$title" --body "$body" --json
     ```

     Do not use `--ai`; the release summary and rollback details must come from
     verified evidence. Do not pass `--no-template` unless the repository template
     has been checked and intentionally should be skipped.

   - Capture the PR number and URL from the CLI response. Read the created PR back
     using `gitee pr view <number> --repo openIndu/infra-deploy --json`, then inspect its diff with
     `gitee pr diff <number> --repo openIndu/infra-deploy`. Verify source and base
     branches, full head SHA, intended manifest-only diff, and actual image value.

   After success or error, inspect Gitee before retrying. Journal
   `action: "reconcile"` with key, `result`, reason and hashed read-back artifact.
   APPLIED requires `prId`, `url`, `actualBranch`, `actualBaseBranch`, full
   `actualBaseSha`, `actualHeadSha` and `actualImage` equal to intent. If the base
   moves after PR creation, first record BLOCKED with the same PR identity and
   observed base SHA, then use `action: "refresh_base"` to re-read that existing
   PR's branches, head, image and new base SHA. This updates the same intent; it
   never creates another PR. Every read-back is appended to history; an APPLIED
   record cannot be downgraded to NOT_APPLIED or replayed under another key.
   Independent task/image releases remain allowed. NOT_APPLIED records evidence
   of absence; BLOCKED preserves uncertain effects. Never blindly recreate a PR.

## Report and apply boundary

Default terminal state is GITOPS_PR_VERIFIED, not deployed. Report source SHA,
digest, Gitee PR, expected/actual manifest matrix, rollback and pending delivery
stages. Journal APPLIED means the PR write occurred, not that production changed.
Merge requires applicable checks, human review and explicit L2 authorization;
read back GitOps main if separately authorized. Provide the exact merged-manifest
apply command for the human cluster operator. The agent never runs production
kubectl apply/edit or holds kubeconfig. Production rollout/health require separate
operator evidence. Persist the journal, then release owned leases.

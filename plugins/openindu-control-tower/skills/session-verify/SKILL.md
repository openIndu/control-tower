---
name: session-verify
description: Dispatch an independent cross-session re-inspection of a just-completed development change — red-green honesty re-derivation, four-lens correctness, scope stat, acceptance coverage. Peer Claude session preferred; reviewer/inspector agent fallback. Agent findings have veto power; they never replace human approval (spec/013).
argument-hint: "<repo> <merge-commit-or-PR-ref> [issue-number]"
disable-model-invocation: true
---

# /session-verify — cross-session independent re-inspection dispatch

Call `/principle` first (RULE 1). This skill owns ONE thing: after a development
session claims a change is complete, an **independent context** re-verifies it
from code and live execution — never from the dev session's self-description.

Governance boundary (spec/014, extends spec/013): the verifying session/agent
**has veto power** (findings block merge or force rework) but never satisfies or
replaces the human review gate.

## Step 1 — Build the verification brief from the actual change

Never from the dev session's prose. Collect:

```text
git fetch origin
git show <merge-commit> --stat          # scope: exactly the declared files
git show <merge-commit>^:<path>         # parent-commit preimages (for red re-derivation)
gh pr view <n> --json files,body        # self-claims + acceptance claims
gh issue view <issue> --json body,comments   # acceptance items (check ALL comments)
```

Assemble the brief with four mandatory sections:

1. **Red-green honesty re-derivation** — for every behavior-fix: re-derive from
   the parent commit. Method: `git worktree add <tmp> <parent-sha>` (shared
   checkout stays untouched), apply the new tests to the worktree, run them —
   the survival/correctness assertions MUST fail on the unfixed code; then run
   on the fixed tree — all green. Remove the worktree afterwards.
2. **Correctness four lenses** (RULE 5.2): correctness (NULL semantics, vocabulary
   completeness, edge inputs), security (credentials, data exposure, injection),
   maintainability (three-way consistency: code / docstring / rules comments),
   architectural consistency (mount/registration patterns, module boundaries).
3. **Scope** — `git show <merge> --stat`: exactly the declared files; flag anything
   undeclared.
4. **Acceptance coverage** — map every issue acceptance item to: dev-side done
   (with evidence) / owner-side pending / not covered. Include any
   production-check SQL or commands the owner must run.

Close the brief with the independence rules and the findings format (below).

## Step 2 — Dispatch to an independent context

**Author-session exclusion is absolute**: the verifying context must not be the
session that wrote the change.

Preference order:

1. **Peer Claude session** (true independent context): `ListAgents` → pick an
   idle peer session on the same machine that is not the author session →
   `SendMessage` with the brief. State: read-only re-inspection, shared-checkout
   zero contact (worktree isolation for any test re-run), report findings back
   via SendMessage. Wait for the findings.
2. **Fallback — spawn an agent** (no peer session available): spawn
   `openindu-control-tower:reviewer` with the same brief. The agent runs the
   checks itself and returns findings.

If the brief requires running tests, the verifying context uses its own worktree
or a disposable container — never the shared checkout with uncommitted state.

## Step 3 — Relay findings and route

Findings arrive as per-lens sections with `[severity]` + evidence and a final
verdict (修复是否成立 / 测试是否可信 / 有无返工点). Route:

| Verdict                 | Action                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| critical/major findings | Rework loop: hand findings back to the dev session; re-dispatch verification after rework   |
| clean verdict           | Post the re-inspection receipt to the PR/issue; the human approval gate (RULE 5.2) proceeds |

Receipt format: brief + findings + verdict + (for retrieval-type changes) the
three-category probe record — 命中 / 显式报错 / 识别通过但空结果（第三类 =
语料或口径工单依据，见 spec/014 design point 6）.

## Embedded pitfalls (each cost a real cycle on 2026-11-23/24)

- **Do not trust self-reports** — re-derive everything from code and execution;
  the discipline is what makes self-reports trustworthy afterwards.
- **Stale snapshots**: before asserting "X is not in main", fetch latest — the
  author may have pushed while you inspected.
- **Shared checkouts are shared**: never switch branches or clean state while
  another session may be mid-edit; coordinate by message first.
- **Test counting after conflict fusion**: lost content often survives syntax
  checks; compare test counts before/after.
- **Console mojibake ≠ content corruption**: verify file bytes (grep/od) before
  "fixing" CJK text; patch files with Write/Edit, never heredoc string replace.
- **SPA lazy chunks**: route-component markers live in their own chunk files —
  grep the whole assets directory, not just index-*.js.

## Related

- `/dev_issue` — the development-side workflow this skill verifies.
- `/delivery-check` — RULE 11 pipeline completeness (run after a clean verdict).
- spec/014 — this skill's governance record; spec/013 — the agent-veto boundary.

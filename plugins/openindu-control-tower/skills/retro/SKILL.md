---
name: retro
description: Consolidate the mistakes made during the current session into durable lessons — harvest errors and corrections with evidence, dedupe against the lessons store, write entries, and surface governance gaps as proposals only.
argument-hint: "[--scope <N messages>] [--dry-run]"
disable-model-invocation: true
---

# /retro — Session-error lessons

Call `/principle` first (RULE 1). Run at a natural session boundary: after a
fix lands, after a user correction, or at session end. With `--dry-run`,
produce the candidate lesson list and target paths but write nothing.

## Harvest

Re-read this session (the harness transcript, or the conversation history
still in context; `--scope` limits to the last N messages). Collect every
distinct failure class, keeping the concrete incident as evidence:

- Tool/API errors — including ones that still applied a side effect (verify
  the authoritative state before retrying; never treat an error as success).
- User corrections of agent output — the strongest signal; record what the
  user said and the wrong default behavior it replaces.
- Rework — the same mistake class appearing twice means the first fix did
  not generalize; the lesson is about the class, not the instance.
- False greens — checks that passed while the feature was broken (vacuous
  tests, wrong environment, stale build artifacts).
- Silent failures — commands that "succeeded" while doing nothing.

For each: what happened → root cause → the generalizable rule. Discard
one-off incidents with no transferable rule. Never invent a lesson the
session does not evidence.

## Dedupe and write

1. Read the target lessons store before writing. Default targets, in order:
   the team lessons ledger via `/memory --add <role>` when the team
   structure exists; otherwise the workspace's documented memory directory
   (check its AGENTS.md / CLAUDE.md); if none is documented, ask the user.
   Never invent a location.
2. Skip or merge into an existing entry when the lesson is already recorded;
   report "already covered by <entry>" instead of duplicating.
3. One entry per lesson: the rule, why (root cause), how to apply, and a
   pointer to the incident. Append only — never rewrite or delete existing
   lessons (RULE 6); a correction appends and names the entry it corrects.

## Governance gaps

If avoiding the mistake needs more than a memory entry — a RULE change, a
new hook, an edit to a skill or route — do NOT apply it here. List it as a
proposal (L2) with its evidence, addressed to manager/inspector. This skill
writes memories, not governance.

## Report

End with an acceptance table: lesson | store path | written | dedupe
verdict. Read every written file back before reporting; a whole-task
"done" without read-back is a false green.

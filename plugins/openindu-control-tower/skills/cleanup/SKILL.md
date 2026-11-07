---
name: cleanup
description: Close out a session — inventory intermediate artifacts, file durable deliverables into the documented docs/scripts trees with references fixed, and delete throwaways only after the user confirms the printed target list.
argument-hint: "[--dry-run] [--yes]"
disable-model-invocation: true
---

# /cleanup — Session close-out

Call `/principle` first (RULE 1). With `--dry-run` (and by default whenever
no `--yes` was given), print the plan and change nothing.

## 1. Inventory

List what this session created or touched outside the finished deliverables:
session temp files, scratch scripts, download dumps, draft PR bodies, debug
screenshots, stale intermediates in the working tree. Include the paths that
other files reference.

## 2. Classify — four boxes, nothing else

| Class                                   | Action                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Deliverable (report, export, final doc) | Move into the workspace's documented persistent-docs tree, following its project-subdirectory layout                                |
| Durable script (rerunnable, referenced) | Move into the persistent-scripts tree; hook- or launcher-referenced files stay where they are — moving them silently breaks callers |
| Throwaway (one-off, easily regenerated) | Delete                                                                                                                              |
| Unknown                                 | Ask the user; never guess into a delete                                                                                             |

If no persistent location is documented, ask; do not invent one.

## 3. References before moves

Before moving anything, find what references the old path (workspace docs,
memory indexes, scripts). Fix each reference and append a change record to
each edited document (RULE 6): what moved, from where, to where, when. A
completed artifact's paths change only with user confirmation.

## 4. Delete gate

Deletion is L2. Print the full target list with a one-line safety
justification per file, then require explicit user confirmation — `--yes`
pre-authorizes only the scope that was explicitly enumerated with the user.
Before deleting, verify the deliverables of the same task are intact and
readable; failed verification blocks deletion. Never touch: in-progress
checkouts/worktrees, files another session or agent may be using, completed
artifacts without RULE 6 confirmation.

## 5. Report

Acceptance table: path | class | action | verified read-back. State what was
NOT touched and why. Every claimed deletion is verified gone; every claimed
move is verified present at the new path — zero unverified rows.

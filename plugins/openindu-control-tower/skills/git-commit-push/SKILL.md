---
name: git-commit-push
description: Land the current work as a reviewed commit on a feature branch, push, and open a PR under the repository's own rules — attribution, lint gates, English Gitee PRs, Draft under auto-merge, CI green before ready.
argument-hint: '[--message "<summary>"] [--draft] [--no-push] [--base <branch>]'
disable-model-invocation: true
---

# /git-commit-push — Commit, push, PR

Call `/principle` first (RULE 1). This skill lands already-finished work; it
does not design, implement, or test. It never targets `main`/`master`
(RULE 7) and never bypasses hooks.

## 1. Scope and safety

- `git status` plus `git diff --name-only <base>`: every changed path must
  belong to the declared change set; anything unexplained is flagged, not
  committed silently.
- Scan the diff for credentials, tokens, and keys before committing
  (RULE 5.4). A hit stops everything: the credential must be rotated, not
  just uncommitted.

## 2. Branch and commit

- On `main`/`master`? Create `feat/` / `fix/` / `chore/` first. Never
  commit to the trunk, never force-push, never `--no-verify`.
- Attribution follows the repository's own convention — read recent
  `git log` message bodies first. openIndu product repos require
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`; third-party OSS
  contributions (ASF, opensourceways) must NOT carry it. When unclear, ask.
- Message: `type: summary`, no leading `@`. Long or markdown-bearing
  messages go via `-F <file>`, never inline `-m` — the shell command-
  substitutes backticks inside `-m` and can execute embedded text.

## 3. Lint before commit (RULE 2)

Run the repository's documented format/lint gates (prettier / ruff / eslint
/ repo pre-commit) before committing, so CI format checks pass first try.

## 4. Push

One `git push` per command — compound commands that mention branch names
can trip push-protection hooks, and hooks that cannot parse a command may
fail open. Read the push back (`git ls-remote origin <branch>`); an error
that may still have applied a side effect is verified, never retried blind.

## 5. PR

- GitHub: `gh pr create --body-file <file>`; body ends with the Claude Code
  attribution footer.
- Gitee: title and body fully in English (RULE 9).
- Repos with auto-merge workflows: open as Draft; flip to ready only when
  CI is green and the scope is verified.
- Third-party/community repos: the PR text is an outbound statement — show
  the verbatim draft and get explicit user approval before creating.

## 6. Ready means green

CI green on the PR head is the ready signal; pushed-but-red is not done
(RULE 2, RULE 11). Report an acceptance table: commit SHA | branch | PR # |
required checks | read-back result. `--no-push` stops after the commit.

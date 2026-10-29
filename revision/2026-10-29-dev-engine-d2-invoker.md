---
date: 2026-10-29
slug: dev-engine-d2-invoker
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#28
---

# engine/carrier/invoker.mjs: headless invocation argv builder (spec/005 stage 5, PR-D2)

## Summary

Second PR of stage 5, following D1 (`#27`, the Docker carrier + positive controls). This PR adds the pure functions that construct a headless `claude` invocation inside that carrier — the `docker compose run` argv, the minimal env, and the `--append-system-prompt-file` content — without shelling out itself. The actual `docker compose run` call (via an injected exec function, same dependency-injection pattern as the rest of `engine/`) is stage 7's concern, when `/dev` itself is built.

## What this PR adds

`engine/carrier/invoker.mjs`:

- `roleNeedsBash(role)` — `plan`/`review` never get Bash; `implement`/`fix` do. An unrecognized role throws rather than silently defaulting either way.
- `buildAppendSystemPrompt(...)` — the `--append-system-prompt-file` content: Rule #1 anchor text + current principle text + (if present) the target repo's own `CLAUDE.md`/`AGENTS.md`. Works correctly with neither present (studio has no `.claude/` directory) since `--bare` skips CLAUDE.md auto-discovery entirely — this is the only path by which the agent ever sees that context.
- `buildAgentEnv(...)` — the complete, explicit env passed to `docker compose run -e ...`: `ANTHROPIC_API_KEY`, `OPENINDU_DEV_ACTIVE=1`, the three proxy variables, `GIT_TERMINAL_PROMPT=0`, and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` (D1's documentation finding — skips optional Datadog calls the proxy would otherwise just block). Constructed explicitly rather than inherited from the host process, so the whole allowlist is visible in one place in review rather than relying on "Docker doesn't leak the host env" as an implicit property.
- `buildDockerComposeRunArgs(...)` — the full argv: mounts only the worktree (nothing else, ever); always includes `--bare --restricted --strict-mcp-config`; adds `--tools Bash` + `--allowedTools <...>` only for roles that need it; the prompt/issue text travels by file path, never appended into `claudeArgs` itself, so it can never be parsed as a flag or shell-interpolated.

## Mutation-style verification

- Changed `roleNeedsBash(role)`'s gate to unconditionally push `--tools Bash` regardless of role. Result: exactly the one test asserting plan/review get no `--tools` went red (10 pass / 1 fail). Reverted.
- Added a second, unsolicited `-v /var/run/docker.sock:/var/run/docker.sock` mount into `composeArgs`. Result: exactly the one test asserting the mount list is worktree-only went red (10 pass / 1 fail). Reverted.

Both back to fully green after restoring.

## Test result

```
engine/carrier/invoker.test.mjs: 11/11
```

Plus D1's `proxy.test.mjs` (5/5) and all 215 other pre-existing engine/issue-pipeline tests, all reconfirmed green. `check-version-bump.mjs` (`5.14.0 → 5.15.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally.

## Known gaps, stated rather than hidden

- This module only builds argv/env values; nothing in this PR actually calls `docker compose run`. The first real end-to-end invocation (and the first real confirmation of the proxy round-trip with a genuine API key, flagged as still open in D1's revision doc) will happen when stage 7 wires this into `/dev`.
- `--json-schema` support is wired through but has no caller yet exercising it with a real schema.

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None to any existing repo — nothing calls this module yet |
| Rollback        | Revert the PR                                             |

## Next

D3: review panel, plan solidification, and the reasoning-layer eval suite (section 6 criterion #11) — the eval run itself is expected to be comparably expensive to the SA-1 eval from stage 1, to be flagged explicitly before running rather than folded into the standing batch-merge authorization.

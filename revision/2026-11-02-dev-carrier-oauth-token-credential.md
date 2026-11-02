---
date: 2026-11-02
slug: dev-carrier-oauth-token-credential
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#83
---

# F8-27: let the /dev carrier run on a subscription OAuth token, not just a Console API key

## Summary

The maintainer tried the stage-8 dry-run against `openindu-studio#76` and hit a hard wall: this
machine's only Claude Code login is a subscription OAuth session, with no separate Anthropic
Console API key ever provisioned. Docker, the egress proxy, the network path, and the `claude`
CLI itself were all confirmed healthy end to end (a direct `docker compose run` with a fake key
got a clean `Invalid API key` rejection from the real API, proving the request reached
Anthropic) -- the only actual blocker was `ANTHROPIC_API_KEY` having nothing to read.

`claude setup-token` produces a long-lived `CLAUDE_CODE_OAUTH_TOKEN` billed against the
subscription instead, but the carrier's `invoker.mjs` always passed `--bare` to the `claude` CLI,
and Anthropic's own docs state `--bare` does not read that variable at all. spec/005 section 2.6
locks `ANTHROPIC_API_KEY` in by name as the sole sanctioned credential, so this went through a
spec amendment (not just a code change) -- drafted, sent to `arbiter` for review, revised twice
against two rounds of findings, approved on the second round. See spec/005 section 9's last three
changelog rows for the full back-and-forth.

## What this PR does

`CLAUDE_CODE_OAUTH_TOKEN` is now a sanctioned fallback credential alongside
`ANTHROPIC_API_KEY`, preferred in that order when both are set. Dropping `--bare` outright was
arbiter's round-1 rejection (B1): `--bare` actually skips 8 things (hooks, skills, custom
commands, subagents, installed plugins, MCP servers, auto memory, CLAUDE.md), confirmed against
`code.claude.com/docs/en/headless` -- not just CLAUDE.md re-discovery as first assumed. The fix
is `--safe-mode` instead, which disables the same (or more) and explicitly does not touch
authentication. `--safe-mode` also doesn't disable background tasks the way `--bare` does
(arbiter's B2), so `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` is now set unconditionally in
`docker-compose.yml` rather than relying on either flag for it.

- `engine/carrier/invoker.mjs`: new `detectCredentialEnvVar(env)` (prefers `ANTHROPIC_API_KEY`,
  falls back to `CLAUDE_CODE_OAUTH_TOKEN`, `null` if neither is set, treating `""` as unset);
  `buildDockerComposeRunArgs` takes an optional `credentialEnvVar` (default
  `"ANTHROPIC_API_KEY"`, rejects anything else) and picks `--bare`/`--safe-mode` to match
- `engine/carrier/run-agent.mjs`: `defaultExecShell` now detects the live credential the same
  way, instead of hardcoding `-e ANTHROPIC_API_KEY`
- `engine/carrier/run-positive-controls.sh`: control #6's credential-shaped-env-var scan now
  excludes both sanctioned names, not just one
- `engine/carrier/docker-compose.yml`: added the unconditional `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`
- `engine/carrier-callbacks.mjs`: all 7 `buildRealXxx` callbacks thread `credentialEnvVar` from
  `context` through to their `buildDockerComposeRunArgs` call (defaults preserve every existing
  test's hardcoded `ANTHROPIC_API_KEY` expectation unchanged)
- `skills/dev/scripts/dev.mjs`: detects the credential once per run, before the per-issue loop,
  and fails fast with `ENVIRONMENT_CHECK_FAILED` if neither is set -- instead of letting it
  surface later as an opaque per-issue carrier failure
- also fixed a real CI gap found while touching this code: `.github/workflows/ci.yml`'s `/dev
engine unit tests` step globs `engine/*.test.mjs` directly, which never matched the
  `engine/carrier/` or `engine/carrier/egress-proxy/` subdirectories -- `invoker.test.mjs`,
  `run-agent.test.mjs`, and `proxy.test.mjs` had been passing locally but never actually running
  in CI, the exact hole that step's own comment already warns about for a different file

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 529, pass 529, fail 0
```

7 new tests in `invoker.test.mjs` (per arbiter's explicit guidance: both branches' flag/var
selection, an explicit mutual-exclusion pin across both, `detectCredentialEnvVar`'s own
preference/fallback/absence cases, and the unknown-value rejection). Caught and fixed one real
regression along the way: `dev.test.mjs`'s existing 26 `runRepo` happy-path tests didn't inject a
fake credential detector, so they started failing against this machine's real (credential-less)
environment the moment the new fail-fast check landed -- fixed by adding
`detectCredential: () => "ANTHROPIC_API_KEY"` to the shared `baseRunRepoOverrides` fixture,
matching the same pattern already used there for `runPositiveControls` and
`hasOverdueUnackedMerge`.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-version-bump.mjs` (no bump needed -- `engine/` isn't in `DISTRIBUTED_PREFIXES`, but
`skills/dev/scripts/dev.mjs` is; the script itself reports no bump required against the current
diff).

## Impact

| Scope           | Note                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior change | A run can now authenticate with either a Console API key or a subscription OAuth token                                                                                                                                |
| Blast radius    | `openIndu/control-tower` only; the `/dev` pipeline is still unreachable org-wide -- no repo has `dev.enabled: true`, and this machine's own stage-8 dry-run against studio#76 still hasn't actually been run for real |
| Spec            | spec/005 section 2.6 amended, arbiter-approved, `status: finalized`                                                                                                                                                   |
| Plugin version  | unchanged (no distributed-content path touched; see `check-version-bump.mjs` note above)                                                                                                                              |
| Rollback        | Revert the PR                                                                                                                                                                                                         |

## Next

Before the real stage-8 dry-run against studio#76 can run: the maintainer still needs to either
provision a real Console API key, or run `claude setup-token` and set
`CLAUDE_CODE_OAUTH_TOKEN` via `setx` in a separate terminal followed by a full process restart
(never pasted into chat) -- this PR opens that second path but doesn't supply a credential.
Arbiter's B3 also still needs its one-time empirical pre-flight check (confirm no
hooks/skills/custom commands/subagents/installed plugins surface under `--safe-mode`, and that
background commands/subagents stay unavailable) before treating the new combination as validated
rather than merely spec-approved.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

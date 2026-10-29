---
date: 2026-10-29
slug: dev-engine-d1-carrier
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#27
---

# engine/carrier: network-isolated Docker sandbox + 7 positive controls (spec/005 stage 5, PR-D1)

## Summary

First PR of stage 5. Stage 5 adds the agent runtime isolation layer (spec/005 section 2.6) and the headless invoker (section 4). Splitting the two, same reasoning as every stage-4 split: section 4's own `≤400 lines AND one module boundary` limit, and the stage's own description already separates "carrier selection + positive controls" from "headless invoker" as two distinct items. This PR is the carrier only; the invoker (`invoker.mjs`, which constructs the `docker compose run` argv) is deferred to D2.

## Carrier choice

Section 2.6 explicitly defers the carrier choice to this stage ("容器选择留到阶段 5 决定"). Three options were real candidates on this machine: Docker (installed, v29.5.3), WSL (Ubuntu + docker-desktop distros present), or a separate low-privilege Windows account. This is a real host-system decision with its own blast radius — new containers, network topology — so it was put to the user rather than decided unilaterally. The user chose Docker.

## What this PR adds

- `engine/carrier/egress-proxy/proxy.mjs` — a minimal, zero-dependency forward proxy. Only `CONNECT` (HTTPS tunneling) is handled; plain HTTP requests get `405`. `isAllowedHost` does exact hostname matching only (no substring/suffix matching, so `evil-api.anthropic.com.attacker.com` does not match `api.anthropic.com`). 5 unit tests (`proxy.test.mjs`).
- `engine/carrier/egress-proxy/Dockerfile` — `node:22-slim`, runs as the non-root `node` user.
- `engine/carrier/Dockerfile` — the agent image. `node:22-slim`, `@anthropic-ai/claude-code` pinned to an exact version (see below), `git` installed (for the agent's own local commits inside the mounted worktree only — there is no push capability, enforced by the network topology having no route to GitHub at all, not by git config), credential helper blanked (`git config --system credential.helper ""`, `user.useConfigOnly true`), non-root user `agent` (uid 10001), `GH_CONFIG_DIR` pointed at an empty directory, `GIT_TERMINAL_PROMPT=0`. The 7-positive-controls script (below) is baked in via `COPY` rather than mounted at runtime, so the worktree being operated on can never supply or tamper with the safety check that's supposed to run against it.
- `engine/carrier/docker-compose.yml` — two networks: `agent-internal` (`internal: true` — Docker gives this network no route out of the host at all; this is the actual isolation boundary, not a firewall rule a compromised process inside the container could tamper with) and `proxy-uplink` (normal, for the proxy's own outbound). The `agent` service is attached only to `agent-internal`. The worktree mount is deliberately not declared in the compose file — it's passed at invocation time (`docker compose run -v <worktree>:/workspace`), keeping the file run-agnostic.
- `engine/carrier/run-positive-controls.sh` — runs all 7 of section 2.6's positive controls and prints PASS/FAIL per control, exiting non-zero if any unexpectedly passed. Does not itself decide "exit 5 and never merge" — that decision belongs to the trusted runner process that invokes this script and reads its output (built in D2+).

## CLI version pin

Spec text named `2.1.311`, written before this stage existed. The actual current version at implementation time (`npx @anthropic-ai/claude-code@latest --version`, checked 2026-10-29) is `2.1.312`. Pinned to `2.1.312` — the real current version — rather than installing an already-superseded patch, with this reasoning recorded here rather than silently deviating from the spec text.

## The 7 positive controls — run for real against the live container, not assumed

All run inside the actual built image via `docker compose run`, with the egress-proxy sidecar actually up:

| #   | Control                                                                 | Result                                                                                                                                          |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `gh auth status` / `git credential fill` must fail                      | `gh` is not installed at all; `git credential fill` → `fatal: could not read Username ... terminal prompts disabled`, exit 128                  |
| 2   | Host binary execution via interop must be impossible                    | `cmd.exe`/`powershell.exe`/`gh.exe`/`cmdkey` all absent, exit 1                                                                                 |
| 3   | Reading host mounts / docker socket must fail                           | `/mnt/c` → no such directory, exit 2; `/var/run/docker.sock` → absent                                                                           |
| 4   | Outbound to any non-allowlisted host (incl. `api.github.com`) must fail | Direct `net.connect` to `api.github.com:443` → `EAI_AGAIN` (the internal network has no DNS route out at all, not merely a blocked TCP connect) |
| 5   | Reading outside the worktree must fail                                  | `/root` → permission denied, exit 2; nothing else is mounted                                                                                    |
| 6   | No credential-shaped env var besides the dedicated API key              | Scanned; only `ANTHROPIC_API_KEY` matches, plus the sanctioned `GH_CONFIG_DIR` path (see below)                                                 |
| 7   | MCP tool list must be empty                                             | `claude mcp list` → "No MCP servers configured"                                                                                                 |

Overall script exit code: `0` (all pass).

### Control 6's one nuance

`GH_CONFIG_DIR` matches the `GH_*` pattern the spec names as credential-shaped, but section 2.6 itself requires this exact variable, to redirect `gh`'s own config lookup to an empty directory — it is a path, not a credential. The script treats it as a sanctioned exception and separately verifies its target directory is actually empty, rather than either naively flagging it or naively excluding the whole `GH_*` class.

## Does the CLI actually route through the proxy? (the question that would have made this whole design moot if the answer were no)

This took real investigation, recorded honestly because the first two attempts were inconclusive:

1. **First attempt**: ran `claude --bare -p "hello"` with an obviously-fake API key through the real egress-proxy. Got "Invalid API key" instantly, and the proxy's own log showed no connection attempt at all.
2. **Second attempt**: same, but with a format-plausible fake key (`sk-ant-api03-` + random base64). Same result — instant rejection, no proxy log entry. This means the CLI validates key format locally before ever touching the network; a synthetic key can't be used to observe a live proxy round-trip without spending a real API call.
3. **Indirect behavioral signal**: pointed `HTTPS_PROXY`/`HTTP_PROXY` at a deliberately unreachable host instead of the real proxy. Behavior changed from "instant failure" to "hangs" — consistent with the CLI actually attempting to use whatever proxy address is configured for some outbound call, rather than ignoring the variable.
4. **Static evidence**: the installed CLI is a single compiled binary (`claude.exe`, ~280MB, runs fine on Linux despite the name). `grep -c` against it found 77 occurrences of `HTTPS_PROXY`, 52 of `HTTP_PROXY`, 57 of `NO_PROXY`, 20 of `ProxyAgent` (undici's proxy-tunneling class), 16 of `undici` — far too many to be coincidental.
5. **Documentation, found via the claude-code-guide agent**: [code.claude.com/docs/en/network-config](https://code.claude.com/docs/en/network-config) confirms the CLI "respects standard proxy environment variables" — `HTTPS_PROXY` (recommended), `HTTP_PROXY`, `NO_PROXY`, lowercase forms; SOCKS unsupported; an unparseable proxy URL stops launch. It also documents `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` to skip optional Datadog telemetry hosts, which this carrier's proxy would otherwise just silently block on every run — added to both `docker-compose.yml` and (for D2's use) `invoker.mjs`'s env builder.

Net: documentation + binary evidence + behavioral confirmation all agree the mechanism is real. What was **not** done: a live successful request to `api.anthropic.com` through the proxy with a real, valid key — that would cost real API spend, which is exactly the kind of cost this workspace's rules require flagging before incurring rather than spending incidentally as a side effect of infrastructure testing. First real end-to-end confirmation will happen naturally on D2/D3's first actual invocation, and should be called out explicitly when it does.

## Known gaps, stated rather than hidden

- No live-key proxy round-trip observed (above).
- `run-positive-controls.sh` is integration-verified against the real container rather than unit-mutation-tested — it's a thin shell wrapper over kernel/OS-level facts (DNS resolution, filesystem permissions, socket presence), not logic that has a meaningful "flip a branch and watch a test go red" form. Each "must fail" expectation in the table above is a real observed result, not an assumption.
- `proxy.mjs`'s `isAllowedHost` is unit-tested directly (exact-match only, no substring/lookalike bypass) — this one does have ordinary mutation-style coverage via its 5 tests.

## Test result

```
egress-proxy/proxy.test.mjs: 5/5
```

Plus the engine's other 215 unchanged tests (across `ack`, `admission`, `ci-status`, `circuit-breaker`, `codeowners`, `dev-pause`, `exit-codes`, `guards-core`, `guards-g7-g11`, `log-redaction`, `path-rules`, `route-reader`, `states`, `test-integrity`, `collect-org-issues`), all reconfirmed green in this PR's run. `check-version-bump.mjs` (`5.13.0 → 5.14.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally.

## Impact

| Scope           | Note                                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior change | None to any existing repo — nothing invokes this carrier yet (stage 7's `/dev` skill is the first intended caller, via D2's invoker and beyond)                 |
| Host state      | Adds two local Docker images (`carrier-agent`, `carrier-egress-proxy`) and two Docker networks, created on demand by `docker compose`, not running persistently |
| Rollback        | Revert the PR; `docker compose down` / `docker image rm` removes local Docker state if needed                                                                   |

## Next

D2: the headless invoker (`invoker.mjs` — already drafted and tested locally, held out of this PR purely for the line-count/module-boundary split). D3: review panel, plan solidification, and the reasoning-layer eval suite — the eval run itself is expected to be comparably expensive to the SA-1 eval from stage 1, to be flagged explicitly before running rather than folded into the standing batch-merge authorization.

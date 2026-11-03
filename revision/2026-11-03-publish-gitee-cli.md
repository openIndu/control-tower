# Use Gitee CLI for infra-deploy publication PRs — 2026-11-03

## Summary

Updated `/publish` to create `openIndu/infra-deploy` pull requests with the
authenticated Gitee CLI, verify repository access and branch targets, prevent
duplicate creation, and read the created PR and manifest diff back before the
publication journal can record success. The release role now directs `/publish`
to use the CLI and prohibits credential extraction or raw API writes.

## Files involved

| File area                                                | Change                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/skills/publish/SKILL.md` | Added Gitee CLI preflight, create, read-back, and error-reconciliation steps |
| `plugins/openindu-control-tower/agents/release.md`       | Made Gitee CLI the `/publish` PR method and added credential safeguards      |
| Plugin manifests                                         | Bumped the Claude, Codex, and marketplace versions to `5.49.0`               |

## Trigger and impact

The user requested that future `/publish` submissions to infra-deploy use Gitee
CLI. Impact is limited to the publication workflow instructions and release-role
guidance. No Gitee PR was created by this change.

## Verification

- [x] Local Gitee CLI version `v0.3.3`; `gitee auth status` succeeds without
      exposing the token.
- [x] Read-only repository query confirms `openIndu/infra-deploy`, default
      branch `main`, PRs enabled, and current account pull/push/admin permission.
- [x] CLI help confirms `pr create`, JSON output, explicit head/base/repo fields,
      PR listing and PR read-back commands.
- [x] Full `--json` output was verified for repository, PR-list and PR-view
      responses. The field-projection form emitted empty objects with local CLI
      `v0.3.3`, so the workflow uses full JSON and parses the required fields.
- [ ] Live prompt behavior evaluation: pending; the earlier Anthropic attempt was
      blocked by `403 verification_required` before processing cases.

---
name: revision-new
description: Create a revision record (changelog) in the control-tower repo logging actual changes to principles / route.json / agent definitions / manifest. Mandatory after editing these control-layer assets; without it, changes aren't traceable.
argument-hint: "<change brief>"
disable-model-invocation: true
---

# /revision-new — Write a revision record

`spec/` records **WHAT + WHY** (design); `revision/` records **HOW + WHEN** (what was actually done). One-to-one correspondence; traceable.

**Call `/principle` first** (RULE 1). This skill is used only in the `control-tower` repo.

---

## When you must write one

| Trigger                                   | Basis                                          |
| ----------------------------------------- | ---------------------------------------------- |
| Any `route.json` change                   | control-tower agent constraint #4              |
| Any change to the 11 RULEs                | org-wide impact; must leave a trail            |
| Agent definition / `manifest.yaml` change | behavior change must be traceable              |
| Spec finalized or superseded              | record the status transition                   |
| Public plugin release                     | downstream decides whether to `/plugin update` |

## Naming

```
revision/YYYY-MM-DD-brief-slug.md
```

Use today's **real date** (`date +%F`; don't guess). Multiple entries on the same day use distinct slugs.

## Drafting

Follow `revision/TEMPLATE.md` strictly:

**frontmatter**

```yaml
date: YYYY-MM-DD
slug: brief-slug
type: principle | agent | route | manifest | other
related_spec: NNN-brief-slug # — if none
author: <agent or username>
pr: openIndu/control-tower#NN
```

**Body, four sections**

1. **Summary** — one paragraph: what changed, why
2. **Files involved** — table: path / added·modified·deleted / note. **List each one**; don't write "and several others"
3. **Trigger** — which spec / inspector proposal / user feedback triggered it; cite the specific thread, issue, or PR
4. **Impact assessment** — affected role agents, whether downstream sync is needed, rollback method

**Verification record** — the three checkboxes must reflect actually-run commands:

- [ ] `npx prettier --check "**/*.md"` passed
- [ ] arbiter review passed (if applicable)
- [ ] downstream repos synced (if applicable)

Don't check without running — this record is for the person debugging in the future.

## Submit

```bash
npx prettier --write "revision/YYYY-MM-DD-*.md"
git add revision/YYYY-MM-DD-*.md
git commit -m "docs: add revision record for <change>"
```

PR only; no direct push to main (RULE 7). After the PR merges, backfill the `pr:` field in frontmatter.

> Archived revisions are completed artifacts; don't rewrite them post-hoc (RULE 6). If wrong, write a new correction entry and note which prior entry it corrects.

---
name: spec-new
description: Create a new spec design draft (feature / process improvement / principle evolution) in the control-tower repo, following spec/TEMPLATE.md with a 5-dimension self-check, then submit to arbiter for review. Cross-repo changes, principle edits, and new RULEs must go through this flow first (RULE 5).
argument-hint: "<feature brief>"
disable-model-invocation: true
---

# /spec-new — Draft a spec

RULE 5 requires a reviewable design doc for cross-repo changes and principle evolution. This skill produces a `spec/NNN-brief-slug.md` draft, finalized by **arbiter** review.

**Call `/principle` first** (RULE 1). This skill is used only in the `control-tower` repo.

---

## 1. Pre-check

```bash
git rev-parse --show-toplevel   # must be control-tower
ls spec/                        # see existing numbers; take next 3-digit序号
git status --short              # working tree must be clean
```

Not in the control-tower repo → stop; specs are written only at the control layer.

## 2. Gather inputs

| Must-read                 | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `/principle`              | the 11 RULEs; design must not violate           |
| `/route`                  | which repos affected, which PR flow             |
| `spec/README.md`          | naming, status field, index                     |
| `spec/TEMPLATE.md`        | section structure (follow it, don't invent)     |
| already-`finalized` specs | conflict check                                  |
| `revision/`               | historical changes; avoid overturning decisions |

## 3. Naming

```
spec/NNN-brief-slug.md
```

- `NNN`: 3-digit increment, max existing +1
- `brief-slug`: hyphenated, ≤6-8 words, English or pinyin

## 4. Drafting

Follow `spec/TEMPLATE.md`'s 9 sections strictly; fill each, no placeholders:

1. Background (WHY) — current state, pain, trigger
2. Design points (WHAT) — 3-7 core changes
3. Impact scope — repos / files / which agent lands it
4. Implementation path (HOW) — phased; each phase: start · change · acceptance · rollback
5. Rollback plan
6. Acceptance criteria — each with an **executable verification**, not "confirmed OK"
7. Principle self-check — see below
8. Open questions
9. Change log

frontmatter `status` starts `draft`; `author: control-tower`; `created`/`updated` = today's real date.

## 5. 5-dimension self-check (section 7; arbiter re-checks each)

| Dimension                     | Self-check point                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Principle compliance          | check against 11 RULEs, esp. 7-11 hard constraints; flag conflicts                 |
| Cross-repo contract           | upstream/downstream interface, schema, error codes explicit (RULE 5.3)             |
| Conflict with finalized specs | list the spec ids checked; "no conflict" alone is not enough                       |
| Minimal change                | single change ≤ 400 lines / ≤ 1 module boundary (RULE 4); split phases if exceeded |
| Rollback path                 | must be executable; L3 with no rollback is forbidden (RULE 4)                      |

Any dimension ❌ → fix the design first; don't expect arbiter to wave it through.

## 6. Submit for review

```bash
git checkout -b feat/spec-NNN-brief-slug
npx prettier --write "spec/NNN-*.md"
```

Hand the draft to arbiter:

```
Agent(subagent_type="general-purpose", mode="dontAsk", run_in_background=true,
      prompt="You are openindu-control-tower:arbiter. Review spec/NNN-brief-slug.md …")
```

Review results:

- **approved** → `status: finalized`; notify manager to dispatch to the role agent
- **revision_required** → revise per the 5-dimension feedback, re-submit; **max 3 rounds**
- 3-round deadlock → escalate to manager

## 7. After finalization

- Add a row to `spec/README.md`'s index (NNN / title / status / owner / created date)
- Write a revision record with `/revision-new`
- Merge via PR (RULE 7)

> **A finalized spec is immutable** (RULE 6). To adjust, write a new one with `supersedes: NNN-old`, mark the old one `superseded`, and record the replacement in `revision/`.

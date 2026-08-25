---
name: design-md
description: "Adopt a DESIGN.md design-system document for a project — pick from the awesome-design-md collection or generate one for the user's brand. ui-ux-designer then writes design/uiux/DESIGN.md and frontend implements against it, producing visually consistent UI. Use when a feature needs UI work and there's no design system yet, or to match a known brand's look."
argument-hint: "[--pick <brand> | --generate <description>]"
disable-model-invocation: true
---

# /design-md — Adopt a DESIGN.md design system

[DESIGN.md](https://stitch.withgoogle.com/docs/design-md/overview/) is Google Stitch's plain-text design-system format — color palette, typography, component stylings, layout, depth, do's/don'ts, responsive, and an agent prompt guide. Drop one in a project and AI agents generate consistent UI. The [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) collection provides ready-made DESIGN.md files extracted from real brands (Stripe, Linear, Vercel, Apple, …).

This skill puts a DESIGN.md into the project's `design/uiux/` as the **design source of truth** for `ui-ux-designer` and `frontend`.

**Call `/principle` first** (RULE 1).

---

## 1. Choose the source

```
/design-md --pick linear          # adopt Linear's design language
/design-md --generate "warm minimalism, serif headings, soft surfaces, like Notion"
```

| Mode                         | What happens                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--pick <brand>`             | fetch the brand's DESIGN.md from getdesign.md (awesome-design-md's hosted copies) → save to `design/uiux/DESIGN.md`           |
| `--generate "<description>"` | the ui-ux-designer agent authors a DESIGN.md from the description + the project's existing UI, following the 9-section format |
| (neither)                    | list 10-15 popular brands from the collection for the user to pick                                                            |

## 2. The 9 sections (DESIGN.md format)

Every DESIGN.md must have:

1. **Visual theme & atmosphere** — mood, density, philosophy
2. **Color palette & roles** — semantic name + hex + functional role
3. **Typography rules** — font families + full hierarchy table
4. **Component stylings** — buttons/cards/inputs/navigation with states
5. **Layout principles** — spacing scale, grid, whitespace philosophy
6. **Depth & elevation** — shadow system, surface hierarchy
7. **Do's and don'ts** — design guardrails, anti-patterns
8. **Responsive behavior** — breakpoints, touch targets, collapse strategy
9. **Agent prompt guide** — quick color reference + ready-to-use prompts

## 3. Where it lands + who reads it

```
design/uiux/
├── DESIGN.md          # ← the design system (source of truth)
├── design-system.md   # ← ui-ux-designer's tokens (derived from DESIGN.md)
└── <screen>-ui.md     # ← per-screen specs (must reference DESIGN.md tokens)
```

- **ui-ux-designer** owns `DESIGN.md` + derives `design-system.md` tokens from it; every screen spec references these tokens.
- **frontend** reads `DESIGN.md` + `design-system.md` and implements components that match — no inventing new spacing/colors.
- If a screen spec disagrees with DESIGN.md → DESIGN.md wins.

## 4. Updates

- DESIGN.md is owned by `ui-ux-designer`; token additions go through it.
- A token change → update `design-system.md` + flag affected screens for re-check.
- DESIGN.md is a design artifact (RULE 6): don't edit confirmed versions without user sign-off.

## 5. Boundary

`/design-md` is the design-language _input_. It does not replace `/design` (SDLC orchestration) — `/design` runs the pipeline; `/design-md` ensures the UI phases have a coherent visual target. Run `/design-md` before/at the ui-ux-designer phase if no DESIGN.md exists.

## Attribution

DESIGN.md files from awesome-design-md are extracted from public CSS; use them as references for AI-generated consistent UI, not as claims of brand ownership.

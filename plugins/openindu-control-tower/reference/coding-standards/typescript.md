# TypeScript / React / Vue Coding Standards

> **Authoritative sources**: [TypeScript ESLint](https://typescript-eslint.io/) (linter), [React docs](https://react.dev/learn) (hooks rules), [Vue style guide](https://vuejs.org/style-guide/) (Vue conventions), [ESLint](https://eslint.org/) (base linter — the repo's `eslint.config.js` is the objective enforcer).
>
> **Principle**: The linter (`eslint`) IS the coding standard. If eslint passes, you're compliant. If you disagree with a rule, discuss in an issue — don't `// eslint-disable` silently.

## 1. Imports

| Rule                                                                                           | Source                                 |
| ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| All imports at the **top of the file**, never inside function bodies or component render paths | ESLint `no-import-assign` / convention |
| Use `import type { X }` for type-only imports (faster builds, clearer intent)                  | TypeScript 5.0+                        |
| Named exports preferred for utilities/hooks; default export only for page/route components     | Tree-shaking + explicit                |
| No wildcard imports (`import * as`) unless namespace is intentional                            | Convention                             |
| Import order: external → internal → relative → styles (enforce via eslint-plugin-import)       | Convention                             |

## 2. Types

| Rule                                                                         | Source                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| No `any` — use proper types or `unknown`                                     | `@typescript-eslint/no-explicit-any`            |
| No `as` type assertions unless documented with a comment                     | `@typescript-eslint/strict-boolean-expressions` |
| `interface` for object shapes; `type` for unions/intersections/utility types | TypeScript convention                           |
| Strict `null` checks (`strictNullChecks: true`)                              | tsconfig                                        |
| No non-null assertion `!` without a comment explaining why                   | Convention                                      |

## 3. React (19+)

| Rule                                                        | Source                      |
| ----------------------------------------------------------- | --------------------------- |
| Functional components only — no class components            | React docs                  |
| Hooks rules: no hooks in conditions/loops, always top-level | `eslint-plugin-react-hooks` |
| Custom hooks prefixed with `use` (`useAuth`, `useDebounce`) | React docs                  |
| No inline `style={{}}` when a class/design-token exists     | Design-system fidelity      |
| `useEffect` cleanup on unmount                              | React docs                  |
| Key prop on list items: unique stable ID, not array index   | React docs                  |
| No `dangerouslySetInnerHTML` without sanitization           | React docs                  |

## 4. Vue (3+)

| Rule                                                 | Source           |
| ---------------------------------------------------- | ---------------- |
| Composition API (`<script setup>`), not Options API  | Vue 3 convention |
| `ref` / `reactive` for state; `computed` for derived | Vue docs         |
| Props typed with `defineProps<T>()`                  | Vue 3 + TS       |
| `v-model` with named prop+event in child components  | Vue 3 convention |
| No `v-html` without sanitization                     | Vue security     |

## 5. Error handling & async

| Rule                                                        | Source                         |
| ----------------------------------------------------------- | ------------------------------ |
| Error boundary wrapping async/suspense routes               | React docs                     |
| No unhandled promise rejections — `try/catch` or `.catch()` | ESLint `no-unhandled-promises` |
| Loading / error / empty states on all async data            | UX standard                    |
| No `console.log` in production — remove before commit       | Production standard            |

## 6. Testing

| Rule                                                                      | Source                |
| ------------------------------------------------------------------------- | --------------------- |
| `vitest` (not `jest`) — the repo uses vitest                              | Repo convention       |
| `@testing-library/react` or `@testing-library/vue` for component tests    | Convention            |
| Test files: `*.test.ts(x)` or `*.spec.ts(x)` colocated or in `__tests__/` | vitest convention     |
| Mock external dependencies at the module boundary, not internally         | Testing best practice |

## 7. Styling

| Rule                                                            | Source             |
| --------------------------------------------------------------- | ------------------ |
| Tailwind tokens for spacing/color/typography — no magic numbers | DESIGN.md fidelity |
| `clsx`/`cn` for conditional classes                             | Convention         |
| CSS modules for scoped styles; no global CSS leakage            | Convention         |

import { matchesGlob } from "./path-rules.mjs";

// Normalizes the common CODEOWNERS/gitignore conventions this covers: a
// leading `/` root-anchors (stripped, since our paths never carry one); a
// trailing `/` is a directory (becomes `/**`); a pattern with no `/` at
// all (e.g. `*.mjs`, `README.md`) matches at any depth, not just the root
// (prefixed with `**/`). A pattern containing a `/` in the middle but no
// leading `/` (e.g. `docs/*.md`) is treated as root-anchored -- real
// gitignore semantics would anchor it to the .gitignore file's own
// directory instead of the repo root, but CODEOWNERS only ever lives at
// the repo root for this org, so those are the same thing here. Full
// gitignore-parity patterns (negation, escaped wildcards) are out of
// scope -- a known simplification, not a silent claim of full parity.
function normalizePattern(pattern) {
  if (pattern.startsWith("/")) {
    const normalized = pattern.slice(1);
    return normalized.endsWith("/") ? `${normalized}**` : normalized;
  }
  if (pattern.endsWith("/")) return `**/${pattern}**`;
  if (!pattern.includes("/")) return `**/${pattern}`;
  return pattern;
}

export function parseCodeowners(text) {
  const entries = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    if (owners.length === 0) continue;
    entries.push({ pattern: normalizePattern(pattern), owners });
  }
  return entries;
}

// Last-match-wins, same precedence rule as .gitignore and GitHub's own
// CODEOWNERS evaluation.
export function ownersForPath(path, entries) {
  let owners = [];
  for (const entry of entries) {
    if (matchesGlob(path, entry.pattern)) owners = entry.owners;
  }
  return owners;
}

// The union of CODEOWNERS owners required across every changed path. A path
// with no matching entry contributes nothing -- CODEOWNERS not covering a
// path is not itself a finding (that is RULE 5.3's CODEOWNERS-coverage
// concern elsewhere, not G9).
export function requiredOwners(changedPaths, entries) {
  const owners = new Set();
  for (const path of changedPaths) {
    for (const owner of ownersForPath(path, entries)) owners.add(owner);
  }
  return [...owners];
}

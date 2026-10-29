import assert from "node:assert/strict";
import test from "node:test";

import { ownersForPath, parseCodeowners, requiredOwners } from "./codeowners.mjs";

test("parses pattern-owners lines, skipping comments and blank lines", () => {
  const entries = parseCodeowners(
    "# comment\n\n*.mjs @teamA\n/docs/ @teamB @userC\n",
  );
  assert.deepEqual(entries, [
    { pattern: "**/*.mjs", owners: ["@teamA"] },
    { pattern: "docs/**", owners: ["@teamB", "@userC"] },
  ]);
});
test("skips a pattern line with no owners", () => {
  assert.deepEqual(parseCodeowners("*.mjs\n"), []);
});

test("ownersForPath returns the last matching entry's owners (last-match-wins)", () => {
  const entries = parseCodeowners("*.mjs @default\nengine/*.mjs @engineTeam\n");
  assert.deepEqual(ownersForPath("engine/guards-core.mjs", entries), ["@engineTeam"]);
  assert.deepEqual(ownersForPath("scripts/other.mjs", entries), ["@default"]);
});
test("ownersForPath returns an empty array when nothing matches", () => {
  assert.deepEqual(ownersForPath("README.md", parseCodeowners("*.mjs @team\n")), []);
});
test("a root-anchored pattern with a leading slash still matches via the stripped form", () => {
  const entries = parseCodeowners("/CODEOWNERS @gov\n");
  assert.deepEqual(ownersForPath("CODEOWNERS", entries), ["@gov"]);
});

test("requiredOwners is the union of owners across every changed path", () => {
  const entries = parseCodeowners("engine/*.mjs @engineTeam\ndocs/** @docsTeam\n");
  const owners = requiredOwners(["engine/a.mjs", "docs/readme.md", "unrelated.txt"], entries);
  assert.deepEqual([...owners].sort(), ["@docsTeam", "@engineTeam"]);
});
test("requiredOwners is empty when no changed path has a CODEOWNERS entry", () =>
  assert.deepEqual(requiredOwners(["x.txt"], parseCodeowners("*.mjs @team\n")), []));

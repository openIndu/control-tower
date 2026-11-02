#!/usr/bin/env node
// RULE 4 size cap + test-integrity + protected-path visibility gate for
// EVERY PR to this repo — not just /dev's authorized autonomous-merge runs.
//
// Reuses engine/'s already-tested pure functions as a library (imports
// only; this file does not add, remove or modify anything in engine/, so
// spec/005's own guards and acceptance criteria are untouched):
//   - path-rules.mjs's changedProtectedPaths and test-integrity.mjs's
//     checkTestIntegrity: these only need the diff itself, no /dev-specific
//     context, so they're reused verbatim.
//   - merge-facts.mjs's countTopLevelDirectories (the "module boundary"
//     heuristic): reused verbatim too.
//
// Deliberately NOT a verbatim transplant of guards-core.mjs's guardG4/G5:
//   - G4's "diff must stay inside the plan's declared scope" half has no
//     meaning here. That half only makes sense inside a /dev run, which
//     produces a declared-paths artifact from a solution proposal; an
//     ordinary PR has no such document, so there is nothing to compare
//     against. Treating "no declaration" as "nothing is allowed" would make
//     this check fail on every PR that touches a non-test/doc file — not
//     reused, not reused as an automatic failure either.
//   - G5 compares with AND (<=400 lines AND <=1 module boundary).
//     guards-core.mjs's own comment says that AND is deliberately stricter
//     than RULE 4's own OR, specifically because G5 gates an UNSUPERVISED
//     /dev merge. A human-reviewed PR is RULE 4's case, not G5's extra
//     margin — so this check applies RULE 4's threshold (OR), not G5's.
//   - A protected-path hit is reported as a warning annotation, not a CI
//     failure. RULE 5.2 already governs ordinary PRs by human review across
//     four lenses, and this repo's own legitimate maintenance constantly
//     touches CLAUDE.md / .github/workflows/** — hard-blocking those here
//     would fight this repo's normal workflow instead of helping it. G4's
//     hard block on these paths is specific to the no-human-in-the-loop
//     /dev context.
//
// Usage: node scripts/check-pr-scope.mjs [base-ref]   (default: origin/main)

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { changedProtectedPaths } from "../plugins/openindu-control-tower/engine/path-rules.mjs";
import { checkTestIntegrity } from "../plugins/openindu-control-tower/engine/test-integrity.mjs";
import { countTopLevelDirectories } from "../plugins/openindu-control-tower/engine/merge-facts.mjs";

export function parseNameStatus(raw) {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const statusChar = parts[0][0];
      const path = parts[parts.length - 1]; // rename lines are "R100\told\tnew"
      const status =
        statusChar === "A"
          ? "added"
          : statusChar === "D"
            ? "removed"
            : statusChar === "R"
              ? "renamed"
              : "modified";
      return { path, status };
    });
}

export function sumNumstat(raw) {
  return raw
    .split("\n")
    .filter(Boolean)
    .reduce((sum, line) => {
      const [added, deleted] = line.split("\t");
      const a = Number(added);
      const d = Number(deleted);
      return sum + (Number.isFinite(a) ? a : 0) + (Number.isFinite(d) ? d : 0);
    }, 0);
}

// RULE 4 (principle.md): "Hard上限 per change: ≤400 lines OR ≤1 module
// boundary" — passes if EITHER side is within bound; see header comment for
// why this is the OR, not guardG5's stricter AND.
export function withinRule4SizeCap({ totalLinesChanged, moduleBoundariesTouched }) {
  return totalLinesChanged <= 400 || moduleBoundariesTouched <= 1;
}

export function evaluateScope({ changedFiles, unifiedDiff, totalLinesChanged, moduleBoundariesTouched }) {
  const paths = changedFiles.map((f) => f.path);
  const integrityFindings = checkTestIntegrity({ changedFiles, unifiedDiff });
  const protectedHits = changedProtectedPaths(paths);
  const sizeOk = withinRule4SizeCap({ totalLinesChanged, moduleBoundariesTouched });
  return {
    sizeOk,
    totalLinesChanged,
    moduleBoundariesTouched,
    integrityFindings,
    protectedHits,
    pass: sizeOk && integrityFindings.length === 0,
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

export function gatherFromGit(baseRef, headRef = "HEAD") {
  const changedFiles = parseNameStatus(git(["diff", "--name-status", `${baseRef}...${headRef}`]));
  const unifiedDiff = git(["diff", `${baseRef}...${headRef}`]);
  const totalLinesChanged = sumNumstat(git(["diff", "--numstat", `${baseRef}...${headRef}`]));
  const moduleBoundariesTouched = countTopLevelDirectories(changedFiles.map((f) => f.path));
  return { changedFiles, unifiedDiff, totalLinesChanged, moduleBoundariesTouched };
}

export function main(baseRef = process.argv[2] ?? "origin/main") {
  const facts = gatherFromGit(baseRef);
  if (facts.changedFiles.length === 0) {
    console.log(`✓ 对比 ${baseRef} 无改动，跳过`);
    return 0;
  }
  const result = evaluateScope(facts);

  console.log(
    result.sizeOk
      ? `✓ RULE 4 规模上限：${result.totalLinesChanged} 行，${result.moduleBoundariesTouched} 个模块边界`
      : `::error::超出 RULE 4 上限：${result.totalLinesChanged} 行改动且跨 ${result.moduleBoundariesTouched} 个模块边界（需至少一项达标：≤400 行 或 ≤1 模块边界），请拆分 PR`,
  );
  console.log(
    result.integrityFindings.length === 0
      ? "✓ 测试完整性：无删除测试 / 新增 skip-xfail-only / 降低覆盖率阈值"
      : `::error::测试完整性问题：${result.integrityFindings.join("; ")}`,
  );
  console.log(
    result.protectedHits.length === 0
      ? "✓ 未触及受保护路径"
      : `::warning::本次改动触及受保护路径，请人工重点审查：${result.protectedHits.join(", ")}`,
  );

  return result.pass ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}

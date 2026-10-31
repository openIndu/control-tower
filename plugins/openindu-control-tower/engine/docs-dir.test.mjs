import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DocumentAlreadyExistsError,
  resolveDocsDir,
  reviewDocFileName,
  solutionDocFileName,
  writeIssueDocument,
} from "./docs-dir.mjs";

test("resolveDocsDir defaults to <cwd>/mem_docs/<repo>/dev-runs/<run-id> when OPENINDU_DOCS_DIR is unset", () => {
  const dir = resolveDocsDir("backend", "run-1", {});
  assert.equal(
    dir,
    join(process.cwd(), "mem_docs", "backend", "dev-runs", "run-1"),
  );
});

test("resolveDocsDir honors OPENINDU_DOCS_DIR when set", () => {
  const dir = resolveDocsDir("backend", "run-1", {
    OPENINDU_DOCS_DIR: "/custom/docs",
  });
  assert.equal(dir, join("/custom/docs", "backend", "dev-runs", "run-1"));
});

test("solutionDocFileName and reviewDocFileName match spec/005's naming convention", () => {
  assert.equal(solutionDocFileName(42), "issue-42-solution.md");
  assert.equal(reviewDocFileName(42), "issue-42-review.md");
});

test("writeIssueDocument creates the docs dir and writes the file, returning its path", () => {
  const scratch = mkdtempSync(join(tmpdir(), "docs-dir-test-"));
  try {
    const docsDir = join(scratch, "mem_docs", "backend", "dev-runs", "run-1");
    const path = writeIssueDocument(
      docsDir,
      solutionDocFileName(1),
      "# Solution\n",
    );
    assert.equal(path, join(docsDir, "issue-1-solution.md"));
    assert.equal(readFileSync(path, "utf8"), "# Solution\n");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("writeIssueDocument throws DocumentAlreadyExistsError rather than overwriting an existing document (RULE 6)", () => {
  const scratch = mkdtempSync(join(tmpdir(), "docs-dir-test-"));
  try {
    const docsDir = join(scratch, "mem_docs", "backend", "dev-runs", "run-1");
    writeIssueDocument(docsDir, solutionDocFileName(1), "first\n");
    assert.throws(
      () => writeIssueDocument(docsDir, solutionDocFileName(1), "second\n"),
      DocumentAlreadyExistsError,
    );
    assert.equal(
      readFileSync(join(docsDir, "issue-1-solution.md"), "utf8"),
      "first\n",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

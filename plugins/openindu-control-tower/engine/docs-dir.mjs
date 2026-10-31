import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// spec/005 section 2.1: "方案与评审记录写入工作区文档目录，默认
// mem_docs/<repo>/dev-runs/<run-id>/，可由环境变量 OPENINDU_DOCS_DIR 覆盖；每次
// 运行新建、不覆盖历史产物（RULE 6）". The default is relative to process.cwd()
// -- the workspace launcher (dev/dev.cmd, section 2.1 line 232) is expected to
// invoke this runner from the workspace root; OPENINDU_DOCS_DIR exists
// precisely so a caller never has to rely on that cwd assumption holding.
export function resolveDocsDir(repo, runId, env = process.env) {
  const base = env.OPENINDU_DOCS_DIR ?? join(process.cwd(), "mem_docs");
  return join(base, repo, "dev-runs", runId);
}

export function solutionDocFileName(issueNumber) {
  return `issue-${issueNumber}-solution.md`;
}

export function reviewDocFileName(issueNumber) {
  return `issue-${issueNumber}-review.md`;
}

// RULE 6: a run's documents are never overwritten once written. Throws
// rather than silently clobbering -- a run-id collision (or a caller mistake
// re-invoking this for the same issue twice in one run) must surface, not
// quietly destroy a prior document.
export class DocumentAlreadyExistsError extends Error {
  constructor(path) {
    super(`refusing to overwrite an existing document: ${path}`);
    this.path = path;
  }
}

export function writeIssueDocument(docsDir, fileName, text) {
  const path = join(docsDir, fileName);
  if (existsSync(path)) {
    throw new DocumentAlreadyExistsError(path);
  }
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(path, text);
  return path;
}

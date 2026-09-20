#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const NO_ACTION_LABELS = new Set([
  "duplicate",
  "invalid",
  "question",
  "wontfix",
  "no-action",
]);
const WAITING_LABELS = new Set(["blocked", "waiting", "waiting-for-reply"]);
const HIGH_PRIORITY_LABELS = new Set([
  "security",
  "critical",
  "priority: high",
  "priority-high",
  "p0",
  "p1",
]);

export function parseArgs(argv) {
  const options = { org: "openIndu", state: "open", output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--org") options.org = argv[++index];
    else if (argument === "--state") options.state = argv[++index];
    else if (argument === "--output") options.output = argv[++index];
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.org) throw new Error("--org requires a value");
  if (!["open", "closed", "all"].includes(options.state)) {
    throw new Error("--state must be open, closed, or all");
  }
  return options;
}

export function flattenPages(value) {
  if (!Array.isArray(value)) throw new Error("GitHub response is not an array");
  return value.flatMap((page) => (Array.isArray(page) ? page : [page]));
}

export function issueSignals(labels) {
  const normalized = labels.map((label) => label.toLowerCase());
  return {
    noAction: normalized.some((label) => NO_ACTION_LABELS.has(label)),
    waiting: normalized.some((label) => WAITING_LABELS.has(label)),
    highPriority: normalized.some((label) => HIGH_PRIORITY_LABELS.has(label)),
  };
}

export function normalizeIssue(repository, issue) {
  const labels = (issue.labels ?? [])
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  return {
    id: `${repository.name}#${issue.number}`,
    repository: repository.name,
    repositoryArchived: Boolean(repository.archived),
    number: issue.number,
    title: issue.title ?? "",
    body: issue.body ?? "",
    url: issue.html_url,
    author: issue.user?.login ?? null,
    assignees: (issue.assignees ?? []).map((user) => user.login).sort(),
    labels,
    milestone: issue.milestone?.title ?? null,
    commentCount: issue.comments ?? 0,
    commentsUrl: issue.comments_url ?? null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    signals: issueSignals(labels),
  };
}

export function collectIssues(repositories, fetchIssues) {
  const issues = [];
  const errors = [];
  for (const repository of repositories) {
    if (repository.hasIssues === false) continue;
    try {
      const repositoryIssues = fetchIssues(repository);
      for (const issue of repositoryIssues) {
        if (!issue.pull_request) issues.push(normalizeIssue(repository, issue));
      }
    } catch (error) {
      errors.push({ repository: repository.name, error: error.message });
    }
  }
  issues.sort(
    (left, right) =>
      left.repository.localeCompare(right.repository) ||
      left.number - right.number,
  );
  return { issues, errors };
}

function ghJson(endpoint, fields = {}) {
  const args = ["api", "--method", "GET", "--paginate", "--slurp", endpoint];
  for (const [name, value] of Object.entries(fields)) {
    args.push("-f", `${name}=${value}`);
  }
  const raw = execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return flattenPages(JSON.parse(raw));
}

export function run(options, github = ghJson) {
  const repositories = github(`orgs/${encodeURIComponent(options.org)}/repos`, {
    per_page: 100,
    type: "all",
  }).map(({ name, archived, has_issues: hasIssues }) => ({
    name,
    archived,
    hasIssues,
  }));
  const { issues, errors } = collectIssues(repositories, (repository) =>
    github(
      `repos/${encodeURIComponent(options.org)}/${encodeURIComponent(repository.name)}/issues`,
      { per_page: 100, state: options.state },
    ),
  );
  return {
    schemaVersion: 1,
    organization: options.org,
    state: options.state,
    generatedAt: new Date().toISOString(),
    complete: errors.length === 0,
    repositoryCount: repositories.length,
    issueCount: issues.length,
    errors,
    issues,
  };
}

function usage() {
  return "Usage: collect-org-issues.mjs [--org openIndu] [--state open|closed|all] [--output FILE]";
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const result = run(options);
    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (options.output) writeFileSync(options.output, json, "utf8");
    else process.stdout.write(json);
    if (!result.complete) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();

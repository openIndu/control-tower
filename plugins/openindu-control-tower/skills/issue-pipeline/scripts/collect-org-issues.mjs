#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
  const options = { org: "openIndu", state: "open", output: null, repo: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--org") options.org = argv[++index];
    else if (argument === "--state") options.state = argv[++index];
    else if (argument === "--output") options.output = argv[++index];
    else if (argument === "--repo") options.repo = argv[++index];
    else if (argument === "--route") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) {
        throw new Error("--route requires a value");
      }
      options.route = value;
    } else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.org) throw new Error("--org requires a value");
  if (!["open", "closed", "all"].includes(options.state)) {
    throw new Error("--state must be open, closed, or all");
  }
  if (options.repo === undefined) throw new Error("--repo requires a value");
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
  const seen = new Set();
  const errors = [];
  for (const repository of repositories) {
    if (repository.hasIssues === false) continue;
    try {
      const repositoryIssues = fetchIssues(repository);
      for (const issue of repositoryIssues) {
        const key = `${repository.name.toLowerCase()}#${issue.number}`;
        if (!issue.pull_request && !seen.has(key)) {
          seen.add(key);
          issues.push(normalizeIssue(repository, issue));
        }
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

function toRepoSummary({ name, archived, has_issues: hasIssues }) {
  return { name, archived, hasIssues };
}

export function run(options, github = ghJson) {
  const repositories = options.repo
    ? github(
        `repos/${encodeURIComponent(options.org)}/${encodeURIComponent(options.repo)}`,
        {},
      ).map(toRepoSummary)
    : github(`orgs/${encodeURIComponent(options.org)}/repos`, {
        per_page: 100,
        type: "all",
      }).map(toRepoSummary);
  const { issues, errors } = collectIssues(repositories, (repository) =>
    github(
      `repos/${encodeURIComponent(options.org)}/${encodeURIComponent(repository.name)}/issues`,
      { per_page: 100, state: options.state },
    ),
  );
  const observedNames = repositories.map(({ name }) => name);
  const expectedNames = options.expectedRepositories ?? null;
  const expectedSet = expectedNames
    ? new Set(expectedNames.map((name) => name.toLowerCase()))
    : null;
  const observedSet = new Set(observedNames.map((name) => name.toLowerCase()));
  const missingRepositories = expectedNames
    ? expectedNames.filter((name) => !observedSet.has(name.toLowerCase()))
    : [];
  const unexpectedRepositories = expectedNames
    ? observedNames.filter((name) => !expectedSet.has(name.toLowerCase()))
    : [];
  const inventoryMismatch =
    missingRepositories.length > 0 || unexpectedRepositories.length > 0;
  return {
    schemaVersion: 1,
    organization: options.org,
    repo: options.repo,
    state: options.state,
    generatedAt: new Date().toISOString(),
    complete: errors.length === 0 && !inventoryMismatch,
    coverage: expectedNames
      ? {
          source: options.inventorySource ?? "provided",
          expectedRepositoryCount: expectedNames.length,
          observedRepositoryCount: repositories.length,
          missingRepositories,
          unexpectedRepositories,
        }
      : null,
    repositoryCount: repositories.length,
    issueCount: issues.length,
    errors,
    issues,
  };
}

function usage() {
  return "Usage: collect-org-issues.mjs [--org openIndu --route <route.json> | --repo NAME] [--state open|closed|all] [--output FILE]";
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    if (!options.repo && !options.route) {
      throw new Error(
        "Organization collection requires --route with the canonical repository inventory",
      );
    }
    if (options.route) {
      const route = JSON.parse(readFileSync(options.route, "utf8"));
      if (route.org?.toLowerCase() !== options.org.toLowerCase()) {
        throw new Error(
          `Route inventory organization (${route.org ?? "missing"}) does not match ${options.org}`,
        );
      }
      if (!options.repo) {
        const expectedRepositories = Object.entries(route.repos ?? {}).flatMap(
          ([name, entry]) => {
            let url;
            try {
              url = new URL(entry.url);
            } catch {
              throw new Error(`Route inventory has an invalid URL for ${name}`);
            }
            const [owner, repository] = url.pathname.split("/").filter(Boolean);
            if (url.hostname.toLowerCase() !== "github.com") return [];
            if (url.protocol !== "https:") {
              throw new Error(`Route URL for ${name} must use HTTPS`);
            }
            if (owner?.toLowerCase() !== options.org.toLowerCase()) {
              throw new Error(
                `Route URL for ${name} does not belong to ${options.org}`,
              );
            }
            if (repository?.toLowerCase() !== name.toLowerCase()) {
              throw new Error(
                `Route key ${name} does not match its canonical GitHub URL`,
              );
            }
            return [name];
          },
        );
        if (expectedRepositories.length === 0) {
          throw new Error(
            `Route inventory has no GitHub repositories for ${options.org}`,
          );
        }
        if (
          new Set(expectedRepositories.map((name) => name.toLowerCase()))
            .size !== expectedRepositories.length
        ) {
          throw new Error(
            "Route inventory contains duplicate repository names",
          );
        }
        options.expectedRepositories = expectedRepositories;
        options.inventorySource = "reference/route.json";
      }
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

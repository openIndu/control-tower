import { execFileSync } from "node:child_process";

// Repo types structurally excluded from every dev_grants entry (spec/005
// section 2.3-2). Data cannot override this -- it is checked by type, not by
// a field that route.json's own data could set.
const STRUCTURALLY_EXCLUDED_TYPES = new Set([
  "control-tower",
  "aggregate",
  "gitops",
  "fork",
  "meta",
]);

// Repo types that produce device programs or electrical drawings. These may
// not appear in any grant until dev.safety_paths is registered on them.
const DEVICE_TYPES = new Set(["station", "controller", "vision", "cim", "studio"]);

export function parseRoute(jsonText) {
  const route = JSON.parse(jsonText);
  if (!route.repos || typeof route.repos !== "object") {
    throw new Error("route.json has no repos object");
  }
  return route;
}

function controlTowerContentsEndpoint(path) {
  return `repos/openIndu/control-tower/contents/${path}`;
}

function decodeGitHubContentsResponse(response) {
  if (response.encoding !== "base64") {
    throw new Error(`Unexpected content encoding: ${response.encoding}`);
  }
  return Buffer.from(response.content, "base64").toString("utf8");
}

function ghApiJson(endpoint, fields = {}) {
  const args = ["api", "--method", "GET", endpoint];
  for (const [name, value] of Object.entries(fields)) {
    args.push("-f", `${name}=${value}`);
  }
  const raw = execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(raw);
}

// Live read of route.json's own single source, as of a given ref (G11:
// "合并前实时读取 control-tower 默认分支上的 route"). A failed read must
// propagate, never be treated as "no grants" -- callers must not merge.
export function fetchRouteText(
  ref,
  path = "plugins/openindu-control-tower/reference/route.json",
  github = ghApiJson,
) {
  const response = github(controlTowerContentsEndpoint(path), { ref });
  return decodeGitHubContentsResponse(response);
}

export function isStructurallyExcluded(repoType) {
  return STRUCTURALLY_EXCLUDED_TYPES.has(repoType);
}

export function isDeviceTypeRepo(repoEntry) {
  return (
    DEVICE_TYPES.has(repoEntry?.type) || repoEntry?.delivery_owner === "station-control"
  );
}

function grantCoversRepo(grant, repoName) {
  return Array.isArray(grant.repos) && grant.repos.includes(repoName);
}

function grantIsExpired(grant, now) {
  return new Date(grant.expires_on).getTime() <= now.getTime();
}

// Resolve whether repoName may ever be auto-merged under this route snapshot
// (spec/005 section 2.3, points 1-2). Does not implement G11's live
// ancestry/SA-1-marker/.dev-pause checks -- those need a git/gh call against
// the current moment and live in the guard module (stage 4 C4), not here.
export function resolveRepoAuthorization(route, repoName, now = new Date()) {
  const repoEntry = route.repos?.[repoName];
  if (!repoEntry) {
    return { authorized: false, reason: "repo not in route.json" };
  }
  if (isStructurallyExcluded(repoEntry.type)) {
    return { authorized: false, reason: `structurally excluded type: ${repoEntry.type}` };
  }
  if (isDeviceTypeRepo(repoEntry) && !repoEntry.dev?.safety_paths) {
    return {
      authorized: false,
      reason: "device-type repo with no dev.safety_paths registered",
    };
  }
  const grants = Array.isArray(route.dev_grants) ? route.dev_grants : [];
  const matching = grants.find((grant) => grantCoversRepo(grant, repoName));
  if (!matching) {
    return { authorized: false, reason: "no grant lists this repo" };
  }
  if (grantIsExpired(matching, now)) {
    return { authorized: false, reason: "grant expired", grant: matching };
  }
  return { authorized: true, grant: matching };
}

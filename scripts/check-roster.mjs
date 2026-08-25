#!/usr/bin/env node
/**
 * 席位一致性校验（revision 2026-08-04-roster-cleanup-and-spec002-closure）
 *
 * 背景：stage-4 破坏性改名（backend→python、frontend→web-react+web-vue、infra-deploy→release）
 * 后，多处文档/清单仍引用旧席名 / "7 个 agent" / "frontend 2 副本"。CI 抓 route.json 漂移
 * 很到位，却没有"文档席位数 == agents/ 文件数"与"旧 agent 名禁用"对账——于是文档漂移未被
 * 机器捕获。本脚本补这个缺口。
 *
 * 用法：
 *   node scripts/check-roster.mjs            校验，不一致 exit 1
 *   node scripts/check-roster.mjs --check    同上（CI 调用）
 *
 * 校验项：
 *   1. agents/*.md 文件数 == manifest.yaml roster.total
 *   2. plugin.json / marketplace.json description 含 "{N} 个 maintainer agent"
 *   3. 无旧 plugin-ref：openindu-control-tower:(backend|frontend|infra-deploy)
 *   4. 无旧席名作 agent 用法："(backend|frontend|infra-deploy) agent"、"frontend 副本/2 副本"
 *      （仓库名 openIndu-backend / infra-deploy 仓 不触发）
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(repoRoot, "plugins/openindu-control-tower");

function readText(p) {
  return readFileSync(p, "utf8");
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2];
  }
  return fm;
}

// ---- 1. Count agents/ + validate role frontmatter ----
const agentsDir = join(pluginDir, "agents");
const agentFiles = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
const agentNames = [];
const VALID_ROLES = [
  "governance",
  "ideation",
  "design",
  "build",
  "quality",
  "data",
  "operations",
  "insight",
];
const DESIGN_ROLES = ["ideation", "design"];
for (const f of agentFiles) {
  const fm = parseFrontmatter(readText(join(agentsDir, f)));
  const id = fm.name || f.replace(/\.md$/, "");
  agentNames.push(id);
  if (!fm.role) {
    failures.push(
      `agents/${f}: missing frontmatter role (launch selection key)`,
    );
  } else if (!VALID_ROLES.includes(fm.role)) {
    failures.push(
      `agents/${f}: role="${fm.role}" not in valid set ${VALID_ROLES.join("/")}`,
    );
  }
  if (fm.role === "build" && !fm.languages) {
    failures.push(
      `agents/${f}: role=build requires languages field (array of build-manifest languages)`,
    );
  }
  if (DESIGN_ROLES.includes(fm.role) && !fm.design_dir) {
    failures.push(
      `agents/${f}: role=${fm.role} requires design_dir field (project-repo design domain)`,
    );
  }
}

// ---- 1b. Business-knowledge leak guard (dependency inversion) ----
// Agent definitions must not reference specific repo/module names — that's business knowledge,
// belongs in route.json + each repo's CLAUDE.md. Matches specific repo names only; generic skill
// vocabulary (dispensing/laser/station/collector/IIoT base) is NOT a leak.
const BUSINESS_LEAK_RE =
  /open[Ii]ndu-station|open[Ii]ndu-controller|plc4x|plc4net|open[Ii]ndu-gateway|open[Ii]ndu-backend|open[Ii]ndu-admin|open[Ii]ndu-portal|open[Ii]ndu-collector|open[Ii]ndu-app|open[Ii]ndu-website/g;
for (const f of agentFiles) {
  const text = readText(join(agentsDir, f));
  const m = text.match(BUSINESS_LEAK_RE);
  if (m) {
    failures.push(
      `agents/${f}: business-knowledge leak (specific repo/service name) → ${[...new Set(m)].join(" / ")}. Move binding to route.json + repo CLAUDE.md; agent stays pure role+skill.`,
    );
  }
}

// ---- 1c. Principle-restatement guard (DRY) ----
// Agent behavior-constraints tables must NOT bare-restate universal RULEs (7/8) — they're in /principle
// which every agent loads. Role-specific contextualization (e.g. "device keys" for 5.4) is fine;
// bare "Do not push to main (RULE 7)" / "No K8s manifests (RULE 8)" is duplicate content.
const RESTATEMENT_RE = [
  { re: /Do not push to main \(RULE 7\)/g, label: "RULE 7 restatement" },
  { re: /No K8s manifests \(RULE 8\)/g, label: "RULE 8 restatement" },
  {
    re: /K8s manifests only in the gitops repo \(RULE 8\)/g,
    label: "RULE 8 restatement",
  },
];
for (const f of agentFiles) {
  const text = readText(join(agentsDir, f));
  for (const { re, label } of RESTATEMENT_RE) {
    const m = text.match(re);
    if (m) {
      failures.push(
        `agents/${f}: ${label} in behavior constraints — universal RULEs are loaded via /principle; keep only role-specific rows.`,
      );
    }
  }
}

// ---- 2. 读 manifest roster.total ----
const manifest = readText(join(pluginDir, "reference/manifest.yaml"));
const totalMatch = manifest.match(
  /roster:\s*\n(?:[^\n]*\n)*?\s+total:\s*(\d+)/,
);
const manifestTotal = totalMatch ? parseInt(totalMatch[1], 10) : null;

const agentCount = agentFiles.length;
const expectedTotal = manifestTotal || agentCount;

let failures = [];

// 校验 1：文件数 == manifest roster.total
if (manifestTotal && manifestTotal !== agentCount) {
  failures.push(
    `agents/ 有 ${agentCount} 个 .md，但 manifest.yaml roster.total = ${manifestTotal}——不一致`,
  );
}

// 校验 2：plugin.json / marketplace.json description 含 "{N} 个 maintainer agent"
// Check 2: plugin.json / marketplace.json description contains "{N} maintainer agent"
const pluginJson = JSON.parse(
  readText(join(pluginDir, ".claude-plugin/plugin.json")),
);
const marketplaceJson = JSON.parse(
  readText(join(repoRoot, ".claude-plugin/marketplace.json")),
);
const descRe = new RegExp(`${expectedTotal} maintainer agent`);
for (const [label, obj] of [
  ["plugin.json", pluginJson],
  ["marketplace.json", marketplaceJson.plugins[0]],
]) {
  if (!descRe.test(obj.description || "")) {
    failures.push(
      `${label} description missing "${expectedTotal} maintainer agent". Current: ${obj.description}`,
    );
  }
}

// 校验 3 & 4：旧席名残留扫描
// v3.0.0：6 语言席（java/python/dotnet/web-react/web-vue/rust）已合并为 4 职位席
// （frontend/backend/edge/station-control）。旧 plugin-ref 不得再出现。
// 注：java/python/rust 等也是语言名，只禁 plugin-ref 形式与"X 席"形式，不禁语言/技能语境。
// Checks 3 & 4: stale-name scan
// v5.0.0: 20 SDLC roles. The plugin was renamed openindu-workflow → openindu-control-tower (repo workflow-control-tower → control-tower).
// Stale = (a) the OLD plugin-ref prefix `openindu-workflow:` (renamed), (b) v2 delivery seats (java/python/dotnet/web-react/web-vue/rust) under either prefix, (c) old counts (16/14/7).
// Note: java/python/rust are also language names — only ban plugin-ref form and "X seat" form, not language/skill context.
const stalePatterns = [
  {
    re: /openindu-workflow:[a-z]/g,
    label: "old plugin-ref prefix (renamed to openindu-control-tower)",
  },
  {
    re: /openindu-(workflow|control-tower):(java|python|dotnet|web-react|web-vue|rust)\b/g,
    label: "old v2 delivery plugin-ref",
  },
  {
    re: /\b(web-react|web-vue)\s+seat|\bjava\s+seat\b|\bpython\s+seat\b|\bdotnet\s+seat\b|\brust\s+seat\b/g,
    label: "old v2 delivery seat",
  },
  {
    re: /\b(web-react|web-vue)\s+席|\bjava\s+席\b|\bpython\s+席\b|\bdotnet\s+席\b|\brust\s+席\b/g,
    label: "old v2 delivery seat (CJK)",
  },
  {
    re: /frontend.{0,6}2\s*副本|2\s*副本.{0,6}frontend/g,
    label: "frontend 2 replicas",
  },
  {
    re: /\b(16|14)\s*(个\s*)?agent|\b(16|14)\s*(个\s*)?maintainer|7\s*个\s*(治理\s*)?agent/g,
    label: "old seat count 16/14/7",
  },
];

// 扫描范围：插件内所有 .md / .yaml / .json + 根 README / CLAUDE / team README
const scanTargets = [
  join(pluginDir, "README.md"),
  join(pluginDir, ".claude-plugin/plugin.json"),
  join(repoRoot, ".claude-plugin/marketplace.json"),
  join(repoRoot, "README.md"),
  join(repoRoot, "CLAUDE.md"),
  join(repoRoot, "team/README.md"),
  join(pluginDir, "reference/manifest.yaml"),
  ...agentFiles.map((f) => join(agentsDir, f)),
];
// 插件 skills
for (const s of readdirSync(join(pluginDir, "skills"))) {
  const p = join(pluginDir, "skills", s, "SKILL.md");
  try {
    readText(p);
    scanTargets.push(p);
  } catch {}
}

for (const target of scanTargets) {
  let text;
  try {
    text = readText(target);
  } catch {
    continue;
  }
  for (const { re, label } of stalePatterns) {
    const m = text.match(re);
    if (m) {
      const rel = target
        .replace(repoRoot + "\\", "")
        .replace(repoRoot + "/", "");
      failures.push(`${rel}: ${label} residual → ${m.slice(0, 3).join(" | ")}`);
    }
  }
}

// ---- Output ----
if (failures.length) {
  console.error("✗ Roster consistency check failed:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nFix: align docs/manifest to the current 20 SDLC roles; old names (java/python/dotnet/web-react/web-vue/rust) and old counts (16/14) are deprecated.",
  );
  process.exit(1);
}

console.log(
  `✓ Roster consistent: agents/ ${agentCount} == manifest roster.total ${expectedTotal}`,
);
console.log(
  `✓ plugin/marketplace description contains "${expectedTotal} maintainer agent"`,
);
console.log(
  `✓ No stale seat names (v2 java/python/dotnet/web-react/web-vue/rust; 16/14/7 counts; 2 replicas)`,
);
console.log(
  `✓ No business-knowledge leak (agents don't reference specific repos)`,
);
console.log(`  agents: ${agentNames.join(", ")}`);

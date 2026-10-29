#!/usr/bin/env node
/**
 * 插件/marketplace 版本号一致性 + 次版本号递增校验
 *
 * 校验：
 *   1. plugin.json 与 marketplace.json 里的插件条目版本号必须一致
 *   2. 若本次改动触及插件「分发内容」（skills/ agents/ hooks/ reference/ 与
 *      .claude-plugin/ 本身，不含 evals/ —— eval 用例是测试夹具，不随
 *      /plugin update 分发给下游仓库），版本号必须比 origin/main 上的版本号
 *      「次版本号 +1」（主版本号不变）
 *
 * 用法：
 *   node scripts/check-version-bump.mjs
 *
 * 前提：origin/main 必须可解析 —— CI 的 checkout 步骤需要完整历史
 * （fetch-depth: 0），否则 `git show origin/main:...` 会失败。
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_JSON = join(
  repoRoot,
  "plugins",
  "openindu-control-tower",
  ".claude-plugin",
  "plugin.json",
);
const MARKETPLACE_JSON = join(repoRoot, ".claude-plugin", "marketplace.json");
const PLUGIN_JSON_REL = "plugins/openindu-control-tower/.claude-plugin/plugin.json";

const DISTRIBUTED_PREFIXES = [
  "plugins/openindu-control-tower/skills/",
  "plugins/openindu-control-tower/agents/",
  "plugins/openindu-control-tower/hooks/",
  "plugins/openindu-control-tower/reference/",
  "plugins/openindu-control-tower/.claude-plugin/",
];
// eval 夹具是测试资产，不随 /plugin update 分发给下游仓库，改动不要求版本号 +1
const EXCLUDED_PREFIX = "plugins/openindu-control-tower/evals/";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function readJsonAtRef(ref, relPath) {
  return JSON.parse(git(["show", `${ref}:${relPath}`]));
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// 1. 内部一致性：两份文件里的版本号必须相等
const pluginVersion = readJson(PLUGIN_JSON).version;
const marketplaceEntry = readJson(MARKETPLACE_JSON).plugins.find(
  (p) => p.name === "openindu-control-tower",
);
if (!marketplaceEntry) {
  fail(`marketplace.json 里找不到 openindu-control-tower 插件条目`);
}
const marketplaceVersion = marketplaceEntry.version;

if (pluginVersion !== marketplaceVersion) {
  fail(
    `plugin.json（${pluginVersion}）与 marketplace.json（${marketplaceVersion}）版本号不一致`,
  );
}

// 2. 本次改动是否触及「分发内容」（排除 evals/ 测试夹具）
let changedFiles;
try {
  changedFiles = git(["diff", "--name-only", "origin/main...HEAD"])
    .split("\n")
    .filter(Boolean);
} catch (err) {
  fail(
    `无法解析 origin/main——CI 的 checkout 需要完整历史（fetch-depth: 0）：${err.message}`,
  );
}

const touchesDistributed = changedFiles.some(
  (f) =>
    DISTRIBUTED_PREFIXES.some((prefix) => f.startsWith(prefix)) &&
    !f.startsWith(EXCLUDED_PREFIX),
);

if (!touchesDistributed) {
  console.log(
    `✓ 本次改动未触及插件分发内容，版本号无需变化（当前 ${pluginVersion}）`,
  );
  process.exit(0);
}

// 3. 触及分发内容：版本号必须比 origin/main 恰好「次版本号 +1」
const baseVersion = readJsonAtRef("origin/main", PLUGIN_JSON_REL).version;

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) fail(`版本号格式不是 x.y.z：${v}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

const base = parseSemver(baseVersion);
const next = parseSemver(pluginVersion);

if (next.major !== base.major || next.minor !== base.minor + 1) {
  fail(
    [
      `插件分发内容有改动，但版本号没有按「次版本号 +1」递增`,
      ``,
      `  origin/main： ${baseVersion}`,
      `  本分支：      ${pluginVersion}`,
      ``,
      `  改为 ${base.major}.${base.minor + 1}.0（或更高 patch），plugin.json 与 marketplace.json 两处都要改`,
    ].join("\n"),
  );
}

console.log(
  `✓ 插件分发内容有改动，版本号已正确递增：${baseVersion} → ${pluginVersion}`,
);

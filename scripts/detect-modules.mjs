#!/usr/bin/env node
/**
 * 模块级路由探测（spec/003 阶段 3 的前置）
 *
 * 问题：route.json 的粒度是「仓库」，但 openIndu-platform 是 6 个子模块、4 种语言的
 * monorepo。单一 repo type 无法表达它的技术栈，任何「按 repo type 派活」的机制都会失效。
 *
 * 解法：按**构建清单文件**探测每个模块的语言——这是可程序化判定的事实，
 * 不需要人工维护，也不需要 LLM（RULE 3：能用脚本就别用 LLM）。
 *
 * 用法：
 *   node scripts/detect-modules.mjs                    探测组织全部仓库并打印
 *   node scripts/detect-modules.mjs --repo <name>      只探测一个仓
 *   node scripts/detect-modules.mjs --check            与 route.json 已声明的 modules 比对
 *   node scripts/detect-modules.mjs --json             输出 JSON
 *
 * 依赖 `gh` CLI（已登录）。不 clone 仓库——用 GitHub tree API，对 197 MB 的 plc4x 也是秒级。
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 构建清单 → 语言。顺序即优先级：先匹配到的胜出。 */
const MANIFESTS = [
  { pattern: /(^|\/)pom\.xml$/, language: "java", manifest: "pom.xml" },
  {
    pattern: /(^|\/)build\.gradle(\.kts)?$/,
    language: "java",
    manifest: "build.gradle",
  },
  { pattern: /(^|\/)Cargo\.toml$/, language: "rust", manifest: "Cargo.toml" },
  { pattern: /\.csproj$/, language: "csharp", manifest: "*.csproj" },
  { pattern: /(^|\/)go\.mod$/, language: "go", manifest: "go.mod" },
  {
    pattern: /(^|\/)pyproject\.toml$/,
    language: "python",
    manifest: "pyproject.toml",
  },
  {
    pattern: /(^|\/)requirements(-[\w.]+)?\.txt$/,
    language: "python",
    manifest: "requirements.txt",
  },
  {
    pattern: /(^|\/)package\.json$/,
    language: "javascript",
    manifest: "package.json",
  },
  {
    pattern: /(^|\/)CMakeLists\.txt$/,
    language: "cpp",
    manifest: "CMakeLists.txt",
  },
];

/** 这些路径下的构建清单是依赖或产物，不是模块 */
const IGNORED =
  /(^|\/)(node_modules|target|dist|build|bin|obj|\.venv|venv|__pycache__|vendor)(\/|$)/;

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function listOrgRepos() {
  const out = gh([
    "repo",
    "list",
    "openIndu",
    "--limit",
    "100",
    "--json",
    "name,isEmpty,defaultBranchRef",
  ]);
  return JSON.parse(out)
    .filter((r) => !r.isEmpty && r.defaultBranchRef)
    .map((r) => ({ name: r.name, branch: r.defaultBranchRef.name }));
}

/** 返回该仓的 [{path, manifest, language}]，按路径深度排序 */
function detectModules(repo, branch) {
  let tree;
  try {
    tree = JSON.parse(
      gh(["api", `repos/openIndu/${repo}/git/trees/${branch}?recursive=1`]),
    );
  } catch {
    return { error: "tree unavailable" };
  }
  if (tree.truncated)
    process.stderr.write(`  ! ${repo}: tree 被截断，结果可能不完整\n`);

  // dir -> {rank, manifest, language}
  // 一个目录里可能同时有 Cargo.toml 与 requirements.txt（Rust 项目带 Python 辅助脚本）。
  // 必须取 MANIFESTS 中优先级最高的那个，而不是 tree 里先出现的那个。
  const found = new Map();
  for (const node of tree.tree || []) {
    if (node.type !== "blob" || IGNORED.test(node.path)) continue;
    const rank = MANIFESTS.findIndex((m) => m.pattern.test(node.path));
    if (rank < 0) continue;
    const m = MANIFESTS[rank];
    const dir = node.path.includes("/")
      ? node.path.slice(0, node.path.lastIndexOf("/"))
      : ".";
    const prev = found.get(dir);
    if (!prev || rank < prev.rank) {
      found.set(dir, { rank, manifest: m.manifest, language: m.language });
    }
  }

  return {
    modules: [...found.entries()]
      .map(([path, v]) => ({
        path,
        manifest: v.manifest,
        language: v.language,
      }))
      .sort(
        (a, b) =>
          a.path.split("/").length - b.path.split("/").length ||
          a.path.localeCompare(b.path),
      ),
  };
}

// ---- 主流程 ----

const argv = process.argv.slice(2);
const only = argv.includes("--repo") ? argv[argv.indexOf("--repo") + 1] : null;
const asJson = argv.includes("--json");
const check = argv.includes("--check");

let repos;
try {
  repos = listOrgRepos();
} catch (err) {
  console.error("✗ 无法列出组织仓库，请确认 gh 已登录：" + err.message);
  process.exit(1);
}
if (only) repos = repos.filter((r) => r.name === only);
if (!repos.length) {
  console.error(only ? `✗ 未找到仓库 ${only}` : "✗ 组织下没有非空仓库");
  process.exit(1);
}

const result = {};
for (const { name, branch } of repos) {
  const d = detectModules(name, branch);
  if (d.error) {
    process.stderr.write(`  ! ${name}: ${d.error}\n`);
    continue;
  }
  result[name] = d.modules;
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (check) {
  const route = JSON.parse(readFileSync(join(repoRoot, "route.json"), "utf8"));
  let drift = 0;
  for (const [repo, mods] of Object.entries(result)) {
    const declared = route.repos[repo]?.modules;
    if (!declared) continue; // 未声明 modules 的仓不比对
    const declaredPaths = new Set(
      declared.map((m) => (typeof m === "string" ? m : m.path)),
    );
    const detectedPaths = mods.filter((m) => m.path !== ".").map((m) => m.path);
    const missing = detectedPaths.filter((p) => !declaredPaths.has(p));
    if (missing.length) {
      console.error(`✗ ${repo}: route.json 未声明这些已探测到的模块：`);
      missing.forEach((p) => console.error(`    ${p}`));
      drift++;
    }
  }
  if (drift) {
    console.error(
      "\n请更新 plugins/openindu-control-tower/reference/route.json 后运行 node scripts/sync-route.mjs",
    );
    process.exit(1);
  }
  console.log("✓ route.json 已声明的 modules 与实际探测一致");
  process.exit(0);
}

// 人类可读输出
const byLanguage = {};
for (const [repo, mods] of Object.entries(result)) {
  console.log(`\n${repo}`);
  if (!mods.length) {
    console.log("  （未探测到构建清单）");
    continue;
  }
  for (const m of mods) {
    console.log(
      `  ${m.path.padEnd(44)} ${m.language.padEnd(12)} ${m.manifest}`,
    );
    (byLanguage[m.language] ||= []).push(`${repo}/${m.path}`);
  }
}

console.log("\n" + "=".repeat(72));
console.log("按语言汇总（用于交付席位派活）\n");
for (const [lang, mods] of Object.entries(byLanguage).sort(
  (a, b) => b[1].length - a[1].length,
)) {
  console.log(`  ${lang.padEnd(12)} ${String(mods.length).padStart(3)} 个模块`);
}

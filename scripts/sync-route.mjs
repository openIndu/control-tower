#!/usr/bin/env node
/**
 * route.json 单一来源同步
 *
 *   唯一源：plugins/openindu-control-tower/reference/route.json
 *   同步产物：route.json（仓库根，保留供外部引用）
 *
 * 用法：
 *   node scripts/sync-route.mjs           从唯一源同步到仓库根
 *   node scripts/sync-route.mjs --check   只校验两份是否一致（CI 用，不一致 exit 1）
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(
  repoRoot,
  "plugins",
  "openindu-control-tower",
  "reference",
  "route.json",
);
const TARGET = join(repoRoot, "route.json");

const rel = (p) => relative(repoRoot, p).replace(/\\/g, "/");

function read(path, label) {
  try {
    return readFileSync(path);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`✗ ${label}不存在：${rel(path)}`);
      process.exit(1);
    }
    throw err;
  }
}

const source = read(SOURCE, "唯一源");

// 唯一源必须是合法 JSON，否则同步出去的是坏文件
try {
  JSON.parse(source.toString("utf8"));
} catch (err) {
  console.error(`✗ 唯一源不是合法 JSON：${rel(SOURCE)}\n  ${err.message}`);
  process.exit(1);
}

const check = process.argv.includes("--check");

if (check) {
  const target = read(TARGET, "同步产物");
  if (source.equals(target)) {
    console.log(`✓ route.json 与唯一源一致（${rel(SOURCE)}）`);
    process.exit(0);
  }
  console.error(
    [
      `✗ route.json 与唯一源不一致`,
      ``,
      `  唯一源：  ${rel(SOURCE)}`,
      `  同步产物：${rel(TARGET)}`,
      ``,
      `  路由只能改唯一源那一份。修好后运行：`,
      `    node scripts/sync-route.mjs`,
    ].join("\n"),
  );
  process.exit(1);
}

writeFileSync(TARGET, source);
console.log(`✓ 已同步 ${rel(SOURCE)} → ${rel(TARGET)}`);

#!/usr/bin/env node
/**
 * RULE 7 — Git 主干保护
 *
 * PreToolUse hook：拦截任何推向 main / master 的 git push。
 * 命中则 exit 2（阻断该次工具调用，stderr 反馈给 Claude）；否则 exit 0 放行。
 *
 * 内部错误一律 fail-open（exit 0）——hook 挂掉不该让整个会话不能跑命令。
 * 真正的兜底是 GitHub / Gitee 上的分支保护规则，本 hook 是第一道提醒。
 */

import { execFileSync } from "node:child_process";

const PROTECTED = ["main", "master"];

/** 读取 stdin 上的事件 JSON */
async function readEvent() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

/** 归一化命令串：折叠空白、去掉行继续符，便于匹配 */
function normalize(cmd) {
  return cmd
    .replace(/\\\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 当前分支；取不到返回 null */
function currentBranch(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: cwd || process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 判断一条命令是否会把提交推到受保护分支。
 * 返回 null 表示放行，否则返回阻断原因。
 */
function inspect(command, cwd) {
  const cmd = normalize(command);

  // 逐条切分，避免 `git status && git push origin main` 漏网
  const segments = cmd.split(/(?:&&|\|\||;|\|)/g);

  for (const segment of segments) {
    const s = segment.trim();
    if (!/\bgit\b[\s\S]*\bpush\b/.test(s)) continue;

    // push 后面的位置参数：<remote> <refspec...>
    const after = s.slice(s.indexOf("push") + "push".length);
    const args = after.split(/\s+/).filter(Boolean);
    const positional = args.filter((a) => !a.startsWith("-"));

    // 情况 1：显式写了受保护分支作为 refspec
    //   git push origin main / +main / HEAD:main / refs/heads/main
    for (const arg of positional.slice(1)) {
      const dst = arg.includes(":") ? arg.slice(arg.lastIndexOf(":") + 1) : arg;
      const ref = dst.replace(/^\+/, "").replace(/^refs\/heads\//, "");
      if (PROTECTED.includes(ref)) {
        return `命令 \`${s}\` 会把提交推送到受保护分支 ${ref}`;
      }
    }

    // 情况 2：没写 refspec，但当前就在受保护分支上
    //   git push / git push origin / git push -u origin
    if (positional.length <= 1) {
      const branch = currentBranch(cwd);
      if (branch && PROTECTED.includes(branch)) {
        return `当前分支是 ${branch}，\`${s}\` 会直接推送受保护分支`;
      }
    }
  }

  return null;
}

async function main() {
  let event;
  try {
    event = await readEvent();
  } catch {
    process.exit(0); // 解析不了事件就放行
  }

  const input = event.tool_input || {};
  const command = input.command;
  if (typeof command !== "string" || !command) process.exit(0);

  let reason;
  try {
    reason = inspect(command, event.cwd);
  } catch (err) {
    process.stderr.write(
      `[openindu-control-tower] push 保护 hook 内部错误，已放行：${err.message}\n`,
    );
    process.exit(0);
  }

  if (!reason) process.exit(0);

  process.stderr.write(
    [
      "🚫 已阻断：违反 RULE 7（Git 主干保护）",
      "",
      reason,
      "",
      "openIndu 所有仓库的 main / master 为受保护分支，agent 与人类一律不得直接 push。",
      "",
      "正确做法：",
      "  git checkout -b feat/<slug>     # 或 fix/... chore/...",
      "  git push -u origin feat/<slug>",
      "  然后开 PR（Gitee 仓的 PR 标题正文用英文 — RULE 9）",
      "",
      "不要为绕过本检查而拼接命令字符串——那同样违反 RULE 7。",
      "确需例外时，请让用户自己执行该命令。",
      "",
      "完整守则：调用 /principle",
    ].join("\n") + "\n",
  );
  process.exit(2);
}

main();

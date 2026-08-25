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

/** git 自身的选项里，需要额外吃掉一个值的那几个（`git -C <path> …`）。 */
const GIT_OPTS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--super-prefix",
]);

/** 去掉可执行文件的路径前缀：`/usr/bin/git`、`C:\…\git.exe` → `git`。 */
function isGitToken(token) {
  return /^git(\.exe)?$/i.test(token.replace(/^.*[\\/]/, ""));
}

/**
 * 从一段命令的 token 流里找出**真正的** git 推送调用，
 * 返回每次调用中子命令之后的参数列表。
 *
 * 为什么不能在整串里搜子命令名：那样会被命令里任何一处出现的同名词带偏
 * ——echo 文本、提交信息、文件路径都算——然后把其后的词当成 refspec。
 * 例如 `echo "推送到 main 之前先看一眼"; git push origin feat/x`
 * 会被误判成推送受保护分支。所以这里锚定 `git` 这个**词**，跳过 git
 * 自身的选项，再看它的子命令是不是推送。
 */
function pushArgLists(tokens) {
  const out = [];

  for (let i = 0; i < tokens.length; i++) {
    if (!isGitToken(tokens[i])) continue;

    // 跳过 git 自身的选项，落到子命令上
    let j = i + 1;
    while (j < tokens.length && tokens[j].startsWith("-")) {
      j += GIT_OPTS_WITH_VALUE.has(tokens[j]) ? 2 : 1;
    }

    if (tokens[j] === "push") out.push(tokens.slice(j + 1));
  }

  return out;
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
    const tokens = s.split(/\s+/).filter(Boolean);

    for (const args of pushArgLists(tokens)) {
      const positional = args.filter((a) => !a.startsWith("-"));

      // 情况 1：显式写了受保护分支作为 refspec
      //   `<remote> main` / `+main` / `HEAD:main` / `refs/heads/main`
      for (const arg of positional.slice(1)) {
        const dst = arg.includes(":") ? arg.slice(arg.lastIndexOf(":") + 1) : arg;
        const ref = dst.replace(/^\+/, "").replace(/^refs\/heads\//, "");
        if (PROTECTED.includes(ref)) {
          return `命令 \`${s}\` 会把提交推送到受保护分支 ${ref}`;
        }
      }

      // 情况 2：没写 refspec，但当前就在受保护分支上
      //   裸的 `git push` / `git push <remote>` / `git push -u <remote>`
      if (positional.length <= 1) {
        const branch = currentBranch(cwd);
        if (branch && PROTECTED.includes(branch)) {
          return `当前分支是 ${branch}，\`${s}\` 会直接推送受保护分支`;
        }
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

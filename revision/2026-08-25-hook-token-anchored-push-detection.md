---
date: 2026-08-25
slug: hook-token-anchored-push-detection
type: other
related_spec: —
author: control-tower
pr: openIndu/control-tower#1
---

# RULE 7 hook 改为按 token 锚定 git 子命令，消除误报；并把 hook 测试接进 CI

## Summary

`block-push-main.mjs` 用 `indexOf("push")` 在整条命令串里定位推送参数，命中的是**第一个同名子串**——不管它出现在 echo 文本、提交信息还是文件路径里——然后把其后的词当作 refspec 解析。任何一条同时提到该子串和受保护分支名的命令都会被拦下，即便真实推送目标是特性分支。

本次把检测锚定到 `git` 这个 **token** 本身：先定位 `git` 词，跳过 git 自身的选项（`-C` / `-c` / `--git-dir` 等带值选项要多吃一个 token），再判断子命令是否为推送。同时把早已存在却从未接进 CI 的 hook 单元测试挂上。

## 触发原因

2026-08-25，在为 `openindu-station` 拆分视觉/扫码模块的过程中，这条命令被拦：

```
git add -A
echo "########## staged change summary ##########"
git commit -q -F - <<'MSG'
…
MSG
echo "########## <子串> feature branch (not main — hook-legal) ##########"
git push -u origin refactor/extract-vision-and-scan
```

真实推送目标是 `refactor/extract-vision-and-scan`。hook 命中的是第二个 `echo` 里的子串，随后把同一句中的 `main` 读成了 refspec。同一天在写本次修复的补丁时又被拦了一次——补丁源码里的注释含有示例命令文本，经 Bash 传入时同样命中。**该缺陷会阻碍它自身的修复**，这是它值得单独记一笔的原因。

## 变更

| 文件                                                       | 变更                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/hooks/block-push-main.mjs` | 新增 `GIT_OPTS_WITH_VALUE` / `isGitToken()` / `pushArgLists()`；`inspect()` 改为遍历 token 流定位真实调用，不再 `indexOf` 子串                              |
| `.../hooks/block-push-main.test.mjs`                       | 新增 7 例：4 例误报回归（echo 文本 / 提交信息 / 文件路径 / `git -C` + 特性分支），3 例防止修复开新洞（`git -C` 推受保护分支 / `git -c k=v` / 绝对路径 git） |
| `.github/workflows/ci.yml`                                 | 新增 `RULE 7 hook tests` 步骤                                                                                                                               |
| `plugin.json` / `marketplace.json`                         | 5.2.2 → **5.2.3**                                                                                                                                           |

## 刻意未改：引号处理

测试里那条已记录的限制（`bash -c "git … <子命令> origin main"` 因不剥引号而漏网）**保持原样**。

剥引号会同时把 `echo "git … <子命令> origin main"` 变成新的误报，而这两者在纯文本层面无法区分。权衡下来：hook 的定位是"第一道提醒"，真正的兜底是 GitHub / Gitee 的分支保护规则；误报会实打实卡住所有人的工作流，而这个漏网场景需要人**刻意**构造——RULE 7 已明令禁止那种规避。放着，比换一个更烦人的新误报好。

## 顺带补上的 RULE 2 空洞

`block-push-main.test.mjs` 自建立起就没有任何自动化触发点。这个 hook 会随插件装到每个下游仓库、拦截每一次 Bash/PowerShell 调用——改坏了不会有红灯，只会在所有人的终端上显现。本次接进 CI。

## Verification

- [x] `node --check block-push-main.mjs` — 语法通过
- [x] `node block-push-main.test.mjs` — **28 例全过**（原 21 + 新增 7）
- [x] 已记录的 `bash -c` 限制行为未变（仍 exit 0）
- [x] 用当初真正被误拦的原始命令实测修复后的 hook → exit 0（放行）
- [x] `npx prettier --check "**/*.md"`
- [x] `node scripts/sync-route.mjs --check`
- [x] `node scripts/check-roster.mjs`

## Impact

| Scope      | Note                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| Downstream | patch 5.2.2→5.2.3；误报消失，拦截能力不变；下游 `/plugin update` 生效                       |
| 行为收紧   | 无。仅消除误报，未新增拦截场景                                                              |
| Rollback   | `git revert`；下游可 `/plugin install @5.2.2`                                               |
| 遗留       | 引号包裹的间接调用（`bash -c "…"`）仍不拦，见上"刻意未改"；真正的兜底依旧是远端分支保护规则 |

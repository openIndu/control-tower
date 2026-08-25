# Principle — Agent 行为守则（已迁移）

> **11 条守则的正文已迁移到公共插件，本文件只是指针。**

## 唯一源

```
plugins/openindu-control-tower/skills/principle/SKILL.md
```

## 怎么加载

在任何 openIndu 仓库中调用：

```
/principle
```

前提是该仓已接入公共插件 `openindu-control-tower@openindu`（用 `/adopt` 接入）。

## 为什么改成这样

原来的做法是各仓在 CLAUDE.md 里用相对路径 `../principle.md` 指向本文件。这条路径在任何子仓都解析不了，Rule #1「启动第一步加载守则」因此是一句空指令——三个仓各自演化出了不同版本的守则副本（11 条 / 6 条 / 0 条）。

改用 skill 调用后，`/principle` 与仓库路径无关，全组织拿到的是同一份。

## 改守则的流程

守则由 `control-tower` agent 维护，任一条 RULE 的改动必须：

1. `/spec-new` 写设计草稿
2. 提交 `arbiter` 审核（5 维度，最多 3 轮）
3. `/revision-new` 记录修订
4. 走 PR 合入 main（RULE 7）
5. bump `plugin.json` / `marketplace.json` 的 `version`
6. 各子仓 `/plugin update openindu-control-tower@openindu`

**不要在本文件里写守则正文**——它是指针，写了就是第二份副本。

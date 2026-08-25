---
date: 2026-08-05
slug: build-skill-matches-production
type: manifest
related_spec: —
author: openIndu-website 侧核对（Claude Opus 5）
pr: openIndu/control-tower#27
---

# `/build` skill 与生产实际对齐；route.json 修正 studio 归属

## 变更摘要

> `/build` skill 有三处与 openIndu-website 生产实际不符，照做会推出一个「跑得起来但不对」的镜像。
> 本次按 infra-deploy 清单与子仓 Dockerfile 逐条核对后修正，并顺带修正 route.json 中
> openIndu-studio 的归属描述（它其实是聚合仓的第 4 个 submodule）。插件版本 5.2.0 → 5.2.1。

## 涉及文件

| 文件                                                        | 改动类型 | 说明                                                                  |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `plugins/openindu-control-tower/skills/build/SKILL.md`      | 修改     | Dockerfile 选择 / tag 约定 / build context 三处修正 + `/release` 指引 |
| `plugins/openindu-control-tower/reference/route.json`       | 修改     | website submodules 补 studio；studio 的 release_flow 修正             |
| `route.json`                                                | 修改     | sync-route.mjs 同步产物                                               |
| `.claude-plugin/marketplace.json`                           | 修改     | version 5.2.0 → 5.2.1                                                 |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json` | 修改     | version 5.2.0 → 5.2.1                                                 |

## 触发原因

> openIndu-website 侧发现插件 `/build` 与该仓自有的 ④+⑤ 命令同名，评估是否重复时逐条核对，
> 结论是「不是重复，是两套不兼容的约定压在同一个名字上」，且插件那套与生产不符。
> 该仓已将自有命令改名 `/release`（openIndu/openIndu-website#175），本 PR 修插件这一侧。

### 三处不符（均已按实际核对）

1. **Dockerfile 选择** —— 表格让 admin/portal 用 `Dockerfile`。实际两个前端仓各有两份：
   `Dockerfile` → `COPY nginx.conf`（内含 `proxy_pass http://web-api:8004/api/`，为 compose 栈准备），
   `Dockerfile.k8s` → `COPY nginx.k8s.conf`（注释明写 `/api/` 由 Ingress 路由，不做 proxy_pass）。
   照原表构建会把 compose 版配置烤进生产镜像。注意后果不是硬失败——集群里确实有 `web-api`
   Service 监听 8004，名字解析得通——而是多一跳代理并绕过清单声明的 Ingress 路由，更难排查。

2. **tag 约定** —— 原文用 `YYYYMMDD-N` 且一刀切「never use `:latest`」。实际 infra-deploy 清单钉的是
   git short SHA（`openindu-admin:5097c14` / `openindu-portal:a34e75c`），`YYYYMMDD-N` 在生产里一个都没有。
   且 `rag-server.yaml` 钉的正是 `openindu-backend:latest`——停推 latest 会让该 workload 静默停止跟随后端变更。
   改为：默认 tag = git short SHA；「不要让 Deployment 钉浮动 tag」是对**清单**的约束，不是对**推送**的约束，
   清单未整改前必须继续推该 tag，并给出 `grep -rn "image:.*<service>" <gitops-repo>/` 的先查后删动作。

3. **build context** —— 原文 `--file <service>/Dockerfile .`，context 是聚合仓根目录。各子模块各有自己的
   `.dockerignore`，根目录 context 会让它们全部失效，并把四个子模块和本地 models/ 数据目录一并送进 daemon。
   改为 `./<service>`。

### route.json

`openIndu-studio` 原标 `release_flow: "independent — not in the openIndu-website submodule aggregate"`，
与 `.gitmodules` 不符——它确实是第 4 个 submodule（2026-08-05 核对）。改为 `library`：在聚合仓内，
但不产镜像、infra-deploy 无其清单，故 RULE 11 到聚合仓指针 PR 为止。website 条目的 submodules 数组同步补齐。

## 影响评估

| 影响范围               | 说明                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| 哪些 repo agent 受影响 | `release` / `ops` agent 及任何调用 `/build` 的会话；openIndu-website 已改用自有 `/release` |
| 是否需要下游同步       | 是——各仓 `/plugin update openindu-control-tower@openindu` 获取 5.2.1                       |
| 回滚方法               | revert 本 PR 并回退版本号至 5.2.0；无运行时状态，纯文档/数据变更                           |

## 验证记录

- [x] `npx prettier --check "**/*.md"` 通过
- [x] `claude plugin validate ./plugins/openindu-control-tower --strict` 通过
- [x] `node scripts/sync-route.mjs --check` 通过
- [x] `node scripts/check-roster.mjs` 通过
- [ ] arbiter 审核（本次为 skill/数据修正，未改 RULE 文本；如需仍可补审）
- [x] 下游 openIndu-website 已同步（openIndu/openIndu-website#175 已合并，改用 `/release`）

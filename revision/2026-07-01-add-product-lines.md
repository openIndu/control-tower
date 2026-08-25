# 2026-07-01 — route.json 新增四条产品线

## 变更摘要

`route.json` 新增 4 个仓库入口，将 openIndu 产品栈从"单社区站"扩展为"开源工业软件生态"。

## 新增仓库

| 仓库                  | 层级   | 类型       | 说明                                             |
| --------------------- | ------ | ---------- | ------------------------------------------------ |
| `openIndu-studio`     | 工具层 | studio     | 开发工作流/低代码，当前的"点"（牵引最强）        |
| `openIndu-platform`   | 平台层 | platform   | IIoT 底座（长期护城河）                          |
| `openindu-vision`     | 应用层 | vision     | 工业视觉样板应用，用 studio 构建的第一个变现产品 |
| `openIndu-controller` | 边缘层 | controller | 连真实工业设备，归第二条腿（工业变现）           |

## 产品栈全景

```
应用层   openindu-vision
平台层   openIndu-platform
工具层   openIndu-studio
社区层   openIndu-website（已有）
─────────────────────────
边缘层   openIndu-controller
```

## 已知问题

- `openindu-vision` 仓名为全小写，与其他仓 `openIndu-*` 驼峰命名不一致。建议统一为 `openIndu-vision`，避免 CI/脚本按名匹配时踩坑。

## 关联

- 知识库: `D:\storage\a_a项目管理\openIndu社区-项目管理.md` 下篇
- 演进路线: 点（studio）→ 线（交付链路）→ 面（生态）→ 体（自持）

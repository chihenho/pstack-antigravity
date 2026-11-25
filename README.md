# pstack-antigravity

将 Cursor 官方开源插件 [`cursor/plugins/pstack`](https://github.com/cursor/plugins/tree/main/pstack) 自动同步并适配为 **Antigravity 原生插件** 的跨平台工具（支持 Windows / macOS / Linux）。

## 为什么需要这个仓库？

直接把 Cursor 版 `pstack` 原封不动放进 Antigravity 会遇到几个实际问题：
1. **上下文膨胀**：原版有约 60 个 skill（其中 24 条是 `principle-*` 原则叶子文档），全放顶层会在每轮对话注入大量技能描述。
2. **工具与路径不匹配**：原版技能正文使用 Cursor 术语（`Task`、`AskQuestion`、`todolist`、`~/.cursor/plugins/`、`environment: "cloud"`、`control-ui` 等）以及仅限 Cursor 的模型 slug。
3. **子代理格式与冲突**：`poteto-agent` / `comment-sicko` 需适配为 Antigravity 的 `agents/*.md` 格式（显式声明 `tools`、`subagent: true`）；原版 `swarm` 技能也会与 Antigravity 内置 `swarm` 插件冲突。

本仓库只保存轻量配置与构建脚本，不内置上游源码副本：运行 `node sync.mjs` 时通过 Git sparse-checkout 只拉取上游 `pstack/` 目录到 `.upstream/`（已 gitignore），清洗并转换后输出到 `~/.gemini/config/plugins/pstack/`。

## 快速安装

环境要求：**Git**、**Node.js >= 18**、**Antigravity**。

```bash
git clone https://github.com/chihenho/pstack-antigravity.git
cd pstack-antigravity
node sync.mjs
```

安装完成后，Antigravity 会自动发现 `~/.gemini/config/plugins/pstack/`，下一轮对话即可直接使用 `/poteto-mode`、`architect`、`interrogate` 等技能，无需手动修改 `config.json` 或重启。

## 默认安装内容（Curated 模式）

- **21 个顶层技能（`skills/`）**：`poteto-mode`（含 22 套 playbooks）、`poteto-help`、`architect`、`arena`、`benchmark-checklist`、`blast-radius`、`correct`、`figure-it-out`、`how`、`interrogate`、`no-comments`、`reflect`、`reframe`、`sharpen`、`show-me-your-work`、`tdd`、`teach`、`technical-writing`、`typescript-best-practices`、`unslop`、`why`
- **24 条工程原则（`references/principles/`）**：折叠存放，不占用常驻 skill 列表，由 `poteto-mode` 按需读取
- **11 个低频/专项技能（`references/extra-skills/`）**：折叠存放，避免污染 `/` 菜单（如需全部放开可加 `--all`）
- **2 个适配后的子代理（`agents/`）**：`poteto-agent`、`comment-sicko`
- **Antigravity 适配表（`docs/harness/antigravity.md`）**：自动注入每个技能正文开头，映射 Cursor 工具、子代理参数、模型与路径
- **默认排除**：`setup-pstack`、`make-bot-ui`、`swarm`（避免与内置插件或平台特性冲突）

## 日常更新与多设备同步

- **同步上游最新 `pstack`**：
  ```bash
  git pull && node sync.mjs
  ```
- **常用参数**：
  - `node sync.mjs --no-pull`：跳过 `git pull`，基于本地 `.upstream/` 离线重建（适合修改 `config.json` 或适配表后快速重装）
  - `node sync.mjs --all`：将除排除列表与 `principle-*` 外的所有技能全部暴露到顶层 `skills/`
  - `node sync.mjs --target <dir>`：指定输出目录（默认为 `~/.gemini/config/plugins/pstack`）

## 自定义技能列表

编辑 [`config.json`](./config.json) 中的 `topLevelSkills` 与 `excludedSkills`，然后运行：

```bash
node sync.mjs --no-pull
```

## 目录结构

```text
pstack-antigravity/
├── .gitignore
├── LICENSE
├── README.md
├── config.json                  # 顶层技能白名单 & 排除列表
├── docs/harness/antigravity.md  # Cursor -> Antigravity 工具、模型与路径映射表
├── templates/poteto-agent.md    # Antigravity 版 poteto-agent 子代理模板
└── sync.mjs                     # 跨平台拉取与转换脚本（零第三方依赖）
```

## 致谢与协议

- 上游 `pstack` 插件由 **Lauren Tan ([poteto](https://x.com/poteto))** 开发并开源于 [`cursor/plugins`](https://github.com/cursor/plugins/tree/main/pstack)（MIT License）。
- 本适配与同步工具仓库同样采用 [MIT License](./LICENSE) 开源。

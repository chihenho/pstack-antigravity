English | [简体中文](./README.zh-CN.md)

# pstack-antigravity

A cross-platform sync & adapter tool (Windows / macOS / Linux) that turns Cursor's open-source [`cursor/plugins/pstack`](https://github.com/cursor/plugins/tree/main/pstack) into a clean, native **Antigravity plugin**.

## Why not just copy `pstack` directly?

Dropping the raw Cursor plugin folder into Antigravity hits a few practical issues:
1. **Context bloat**: Upstream ships ~60 skills (24 of which are `principle-*` leaf docs). Exposing all of them at the top level injects dozens of skill descriptions into every turn.
2. **Cursor-specific tools & paths**: Upstream skills reference `Task`, `AskQuestion`, `todolist`, `~/.cursor/plugins/`, `environment: "cloud"`, `control-ui`, and Cursor model slugs.
3. **Subagent schema & name collision**: `poteto-agent` and `comment-sicko` need Antigravity's `agents/*.md` frontmatter (`subagent: true`, `mainAgent: false`, explicit `tools`), and upstream `swarm` collides with Antigravity's built-in `swarm` plugin.

This repository stays tiny and never vendors upstream files: `node sync.mjs` sparse-clones `pstack/` from `cursor/plugins` into `.upstream/` (gitignored), transforms skills/agents for Antigravity, and installs the result to `~/.gemini/config/plugins/pstack/`.

## Quick Start

Prerequisites: **Git**, **Node.js >= 18**, and **Antigravity**.

### 1-Paste Install in Antigravity

Paste this prompt directly into Antigravity on any machine (Windows / macOS / Linux):

```text
Please install https://github.com/chihenho/pstack-antigravity into my Antigravity:
Follow INSTALL_FOR_AGENTS.md in the repo — clone or pull into ~/.gemini/antigravity/scratch/pstack-antigravity, run `node sync.mjs`, verify via GetAllPlugins RPC (filtered) that all 21 skills and 2 subagents are loaded, report the synced upstream version/commit, and give me the [pstack](customization://pstack) link.
```

*(Want Chinese skill/plugin descriptions instead? Replace `node sync.mjs` with `node sync.mjs --lang zh`.)*

### Manual CLI Install

```bash
git clone https://github.com/chihenho/pstack-antigravity.git
cd pstack-antigravity
node sync.mjs
```

Want Chinese (`zh`) descriptions for the plugin, skills, and subagents instead of English?

```bash
node sync.mjs --lang zh
```

Antigravity automatically discovers `~/.gemini/config/plugins/pstack/` — no `config.json` edits or restart required. Skills like `/poteto-mode`, `/architect`, and `/interrogate` are ready from the next turn.

## What Gets Installed (Curated Mode)

- **21 top-level skills (`skills/`)**: `poteto-mode` (with 22 playbooks), `poteto-help`, `architect`, `arena`, `benchmark-checklist`, `blast-radius`, `correct`, `figure-it-out`, `how`, `interrogate`, `no-comments`, `reflect`, `reframe`, `sharpen`, `show-me-your-work`, `tdd`, `teach`, `technical-writing`, `typescript-best-practices`, `unslop`, `why`
- **24 engineering principles (`references/principles/`)**: Folded out of the top-level skill list so `poteto-mode` reads them on demand
- **11 situational skills (`references/extra-skills/`)**: Folded by default to keep the `/` menu focused (pass `--all` to expose all of them at top level)
- **2 adapted subagents (`agents/`)**: `poteto-agent`, `comment-sicko`
- **Antigravity adapter (`docs/harness/antigravity.md`)**: Linked at the top of each skill to map Cursor tools, subagents, models, and paths to Antigravity
- **Excluded by default**: `setup-pstack`, `make-bot-ui`, `swarm`

## Updating & CLI Options

Pull upstream updates and rebuild:

```bash
git pull && node sync.mjs
```

Options:
- `--lang <en|zh>`: Choose description language for `plugin.json`, skills, and agents (defaults to `en`, or `defaultLang` in `config.json`)
- `--no-pull`: Skip `git pull` and rebuild from local `.upstream/` (useful after editing `config.json` or `i18n/zh.json`)
- `--all`: Expose all non-excluded, non-principle skills under top-level `skills/`
- `--target <path>`: Override output directory (default: `~/.gemini/config/plugins/pstack`)

## Customizing Skills

Edit [`config.json`](./config.json) (`topLevelSkills`, `excludedSkills`, `defaultLang`) or [`i18n/zh.json`](./i18n/zh.json), then rebuild offline:

```bash
node sync.mjs --no-pull
```

## Structure

```text
pstack-antigravity/
├── .gitignore
├── LICENSE
├── README.md
├── README.zh-CN.md
├── config.json                  # Default language, curated skill allowlist & exclusions
├── i18n/zh.json                 # Simplified Chinese descriptions for plugin, agents, and skills
├── docs/harness/antigravity.md  # Cursor -> Antigravity tool, model, and path mapping
├── templates/poteto-agent.md    # Antigravity-adapted poteto-agent subagent template
└── sync.mjs                     # Zero-dependency cross-platform sync & build script
```

## Credits & License

- Upstream `pstack` was created by **Lauren Tan ([poteto](https://x.com/poteto))** in [`cursor/plugins`](https://github.com/cursor/plugins/tree/main/pstack) (MIT License).
- This adapter & sync repository is also released under the [MIT License](./LICENSE).

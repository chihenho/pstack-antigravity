# pstack in Antigravity

`pstack` skills use Cursor tool, subagent, model, and path names. In Antigravity, read this file once per session, then map every Cursor reference in a skill using the tables below. `<pstack>` refers to the installed plugin folder (`~/.gemini/config/plugins/pstack`). If a Cursor field has no row, omit it rather than passing an unsupported parameter.

## Tools

| Cursor | Antigravity |
| --- | --- |
| `Task` | `invoke_subagent` |
| `AskQuestion` | `ask_question` (for multi-choice clarification) or ask directly in plain text for simple yes/no questions. |
| Open a todolist, or copy steps into the todolist tool | `update_steps` (and `update_focus` when transitioning phases). |
| `Grep`, `Glob` | `run_command` with `rg` / shell search (`rg -n`, `Get-ChildItem`), then `read_file` with targeted `StartLine`/`EndLine`. |
| Run another pstack skill (`/name` or "the **name** skill") | `read_file` on: (1) `<pstack>/skills/<name>/SKILL.md` for top-level skills, (2) `<pstack>/references/principles/<name>/SKILL.md` for `principle-*` skills, or (3) `<pstack>/references/extra-skills/<name>/SKILL.md` for folded situational skills. |
| `control-ui` (`cursor-team-kit`) | Built-in `browser` subagent (`invoke_subagent` with `TypeName: "browser"`, `Model: "flash"`). |
| `control-cli` (`cursor-team-kit`) | `run_command`. |
| `/deslop` (`cursor-team-kit`) | Apply `unslop` + `no-comments` + `principle-laziness-protocol` (read those files from `<pstack>`). |

## Subagent fields

| Cursor | Antigravity |
| --- | --- |
| `subagent_type: generalPurpose` | `TypeName: "self"` (or `"research"` when `readonly: true`). |
| `poteto-agent`, `comment-sicko` | `TypeName: "poteto-agent"`, `TypeName: "comment-sicko"`. |
| `readonly: true` | `TypeName: "research"` (and explicitly state "do not edit files" in `Prompt`; check `git status` afterward). |
| `readonly: false` | `TypeName: "poteto-agent"` or `TypeName: "self"`. |
| `environment: "cloud"` | `Workspace: "share"` (or `"branch"` for full isolated clone). |
| `environment: "local"` | `Workspace: "inherit"` (or omit). |
| `cloud_base_branch: <b>` | Instruct the subagent in `Prompt` to check out `<b>` first. |
| `run_in_background: true` | Omit (`invoke_subagent` runs in the background by default and delivers results reactively; never poll). |
| `resume` | `send_message` with the existing subagent's `conversationId`. |
| `file_attachments` | List absolute file paths in `Prompt`. For the `browser` subagent, stage reference files in `<Artifact Directory Path>/browser_sandbox/references/<filename>` and uploads in `<Artifact Directory Path>/browser_sandbox/uploads/<filename>`. |

## Models

| Cursor | Antigravity |
| --- | --- |
| Heavy coding, judgment, architecture, or review roles (`claude-opus-*`, `claude-fable-*`, `gpt-*`, `grok-*`, `feature`, `refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, `judgment and prose`) | `Model: "inherit"` (or `"pro"` when explicitly escalating). Antigravity `invoke_subagent` only accepts `"inherit"`, `"pro"`, `"flash"`, or `"flash_lite"`, never Cursor vendor slugs. |
| Lightweight lookups, fast checks, or `browser` subagent | `Model: "flash"` (or `"flash_lite"` for trivial high-volume tasks). |
| `auto` or `inherit-parent` | `Model: "inherit"` (or omit `Model`). |
| Multi-model panels (`arena runners`, `arena cross-judge pool`, `interrogate reviewers`) | Antigravity subagents cannot select external vendor slugs per call. Launch independent parallel subagents (via parallel `invoke_subagent` or `run_workflow`) assigned distinct adversarial perspectives, hypotheses, or review rubrics; for cross-verification, use a fresh isolated subagent that did not author the implementation. |
| `~/.cursor/rules/pstack-models.mdc` or `/setup-pstack` | Not used in Antigravity; ignore and do not read or write `.mdc` model rules. |

## Swarm and parallel fan-out

- When a pstack playbook or `poteto-mode` calls for **swarm** fan-out across independent slices, packages, or hypotheses, use Antigravity's `run_workflow` tool (read the built-in `run-workflow` skill first) or parallel `invoke_subagent` calls.
- **Do not** invoke Antigravity's built-in `swarm` tool unless the user explicitly invoked `/swarm`.

## Paths

| Cursor | Antigravity |
| --- | --- |
| `~/.cursor/plugins/` | `~/.gemini/config/plugins/` (`<pstack>` = `~/.gemini/config/plugins/pstack`) |
| `.cursor/skills/`, `~/.cursor/skills/` | `.agents/skills/`, `~/.gemini/config/skills/` |
| `.cursor/rules/*.mdc`, always-applied rules | `.agents/rules/*.md`, `AGENTS.md`, or `GEMINI.md` |
| `agent-transcripts` in `~/.cursor/projects/<slug>/agent-transcripts/` | `<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript.jsonl` |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | Read the local copy under `<pstack>/` when it exists instead of fetching from GitHub; only give the GitHub URL when linking for the user. |

## Cursor-only features

Antigravity has no Cursor Automations (`benny`), Bugbot service, Cursor cloud agent dashboard, or built-in PR tool. When a step requires one:

- **Cursor Automations, routines, webhooks, Bugbot triggers, or cloud agent dashboard**: output one line `Skipped in Antigravity: <step>. <reason>.` and continue to the next step. If Bugbot left ordinary PR review comments on GitHub, triage them with `gh` CLI via `run_command`.
- **Built-in PR tool**: use `gh` / `git` CLI via `run_command` (no skip line needed).

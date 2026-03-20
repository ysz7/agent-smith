# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Rules

1. **All code in English** — code, comments, variable/function/file names, and commits are in English only.
2. **Stop after each phase** — implement only the current phase, then stop and wait for developer confirmation.
3. **One phase at a time** — don't add extra features or jump ahead.
4. **Ask if unclear** — ask before writing code if anything is ambiguous.
5. **Cross-platform mandatory** — all paths via `path.join` + `os.homedir()`, no hardcoded Unix paths, no `spawn('bash', ...)`.

## Commands

```bash
pnpm install          # install all workspace dependencies
pnpm build            # build all packages
pnpm dev              # run CLI in dev mode (tsx, no compile)
pnpm test             # run tests across all packages

# Per-package
pnpm --filter @agent-smith/core build
pnpm --filter @agent-smith/transport-local build
pnpm --filter @agent-smith/cli build

# Run the agent directly (after build)
node cli/dist/index.js
```

## Architecture

pnpm monorepo with these workspace packages:

| Package | Path | Role |
|---|---|---|
| `@agent-smith/core` | `core/` | Interfaces, AgentSmith class, loaders, memory |
| `@agent-smith/transport-local` | `transport/local/` | WebSocket server, REST API, file storage, cron |
| `@agent-smith/cli` | `cli/` | Entry point, wires everything together |
| `@agent-smith/extension-storage` | `extensions/storage/` | Storage tools for the agent |

### Key abstractions (core/interfaces.ts)

Three interfaces make the system cloud-portable without changing agent logic:
- `IStorage` — `get/set/delete/list` (local: JSON files, future: DynamoDB)
- `ITransport` — `onMessage/send/broadcast` (local: WebSocket+Express, future: Lambda)
- `IScheduler` — `schedule/cancel/list` (local: node-cron, future: EventBridge)

### Message flow

```
Browser WebSocket → LocalGateway.onMessage → AgentSmith.handleMessage
  → Memory.add (user msg)
  → Memory.getRecent(20) → AgentSmith.think()
    → Anthropic API (with tools)
    → handleToolUse() if stop_reason === 'tool_use'
  → LocalGateway.send (response)
  → Memory.add (assistant msg)
```

### Skills

Skills live in `skills/<name>/SKILL.md` (YAML frontmatter + instructions body). Three search dirs, later ones override earlier:
1. `skills/` — built-in (in repo)
2. `~/.agent-smith/skills/` — user-installed
3. `~/.agent-smith/workspace/skills/` — workspace (highest priority)

`SkillLoader` scans dirs, respects `config.skills[name].enabled`, checks extension deps, hot-reloads with 500ms debounce via chokidar.

### Extensions

Extensions are npm packages in `extensions/<name>/`. Each exports a default `register(api: ExtensionAPI)` function that calls `api.registerTool(...)`. Built from `dist/index.js`.

### Config

Stored at `~/.agent-smith/config.json`. Never edited manually — only via UI or `ConfigManager`. Auto-migrates on load with version field. Default model: `claude-sonnet-4-6`.

### REST API (LocalGateway)

- `GET  /api/config` — config with apiKey masked as `***`
- `POST /api/config` — update config
- `POST /api/config/apikey` — save API key
- `POST /api/skills/:name/toggle` — `{ enabled: boolean }`
- `POST /api/extensions/:name/toggle` — `{ enabled: boolean }`
- `GET  /api/skills` — skill config map
- `GET  /api/extensions` — extension config map

WebSocket: client sends `{ type, content, agentId? }`, server sends `{ type: 'connected'|'thinking'|'message'|'error', ... }`.

## Development Status

Currently at **Phase 1 (Core)** — all files implemented and compiling. Next is Phase 2 (UI).

See `agent-smith-plan.md` for full phase-by-phase progress checklist.

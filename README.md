# Agent Smith

A personal AI agent platform. Minimal, beautiful, extensible.

Run it locally in two minutes. Extend it with skills and tools. Works with Claude and local models via Ollama.

---

## Installation

**Requirements:** Node.js 18+ · pnpm · An Anthropic API key _or_ [Ollama](https://ollama.com) for local models

```bash
git clone https://github.com/ysz7/agent-smith
cd agent-smith
pnpm install
pnpm build
pnpm start
```

Browser opens automatically at `http://localhost:3000`. Enter your API key and start chatting.

> **Computer-use extension** requires Playwright Chromium. Run once after install:
> ```bash
> pnpm setup
> ```

---

## Features

### Models
- **Claude** (Anthropic) — default, full tool use, streaming, prompt caching
- **Local models via Ollama** — llama3, qwen2, mistral, and others; auto-detects tool calling support

### Skills
Skills are markdown files that add capabilities to the agent's system prompt. Drop a `SKILL.md` into `~/.agent-smith/skills/` and the agent picks it up instantly (hot-reload, no restart).

Built-in skills:

| Skill | Description |
|-------|-------------|
| `memory` | Remembers facts about you across conversations |
| `web-search` | Searches the internet |
| `calendar` | Creates and manages scheduled tasks |

Install custom skills via **Settings → Skills → Install Skill** in the UI.

### Extensions
Extensions add tools the agent can call. Each is an npm package that registers one or more tools via a simple API.

Built-in extensions:

| Extension | Tools |
|-----------|-------|
| `browser` | `browser_search`, `browser_scrape` |
| `storage` | `storage_get/set/delete/list` — persistent key-value store |
| `email` | `email_send` — requires SMTP config in Settings |
| `notifications` | `notification_send` — desktop notifications |
| `computer-use` | `computer_click`, `computer_type`, `computer_screenshot` |
| `weather` | `weather_get` — current conditions and forecast |
| `files` | `file_read`, `file_write`, `file_list` |
| `crypto` | Price and market data for crypto assets |

### Multi-Agent (Agents Office)
Create multiple persistent agents, each with its own model, system prompt, and chat history. Talk to them in parallel from a single UI.

### Memory (LIMA)
Long-term memory backed by SQLite. The agent recalls relevant facts from previous conversations and decays stale ones over time.

### Scheduled Tasks
```
You: Every day at 9am search for AI news and summarize it
Smith: Scheduled ✓ — daily at 09:00
```

Manage tasks in the **Scheduled Tasks** panel (clock icon in sidebar).

### Proactive Heartbeat
The agent checks for upcoming events, overdue tasks, and reminders on a configurable interval and notifies you without being asked.

### Privacy
- Everything runs locally — no cloud, no telemetry
- Optional local audit log of all AI calls
- API keys stored only in `~/.agent-smith/config.json`

---

## Architecture

pnpm monorepo. Three cloud-portable interfaces keep agent logic independent of infrastructure:

```
core/           Agent logic, memory, skill/extension loaders
transport/      WebSocket server, REST API, cron scheduler
extensions/     Pluggable tools
ui/             React + Vite frontend
cli/            Entry point
```

| Interface | Local | Cloud |
|-----------|-------|-------|
| `IStorage` | JSON files | DynamoDB |
| `ITransport` | WebSocket + Express | Lambda |
| `IScheduler` | node-cron | EventBridge |

---

## Development

```bash
pnpm dev      # run without compiling (tsx)
pnpm test
pnpm build    # compile all packages
```

---

## License

MIT © [Denys Zhodik](https://github.com/ysz7)

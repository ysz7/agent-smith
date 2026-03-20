# Agent Smith

A personal AI agent platform. Minimal, beautiful, extensible.

## Installation

```bash
npm install -g agent-smith
agent-smith start
```

Browser opens automatically at `http://localhost:3000`. Enter your Anthropic API key and start chatting.

Get an API key at [console.anthropic.com](https://console.anthropic.com).

## Requirements

- Node.js 18+
- An Anthropic API key

## Usage

```bash
agent-smith start            # Start the agent
agent-smith skills install <url-or-path>   # Install a skill
```

## Skills

Skills are markdown files (`SKILL.md`) that teach the agent new capabilities. Three built-in skills:

| Skill | Description |
|-------|-------------|
| `memory` | Remember facts about you across conversations |
| `web-search` | Search the internet (requires `browser` extension) |
| `calendar` | Create and manage scheduled tasks |

### Installing custom skills

```bash
# From a URL (GitHub or ClawHub)
agent-smith skills install https://github.com/user/repo/tree/main/my-skill

# From a local folder
agent-smith skills install ./my-skill
```

Or via UI: **Settings → Skills → Install Skill**.

Skills are compatible with [OpenClaw](https://clawhub.com) format.

## Extensions

Extensions add tools the agent can use. Built-in extensions:

| Extension | Tools | Setup |
|-----------|-------|-------|
| `storage` | `storage_get`, `storage_set`, `storage_delete`, `storage_list` | None |
| `browser` | `browser_search`, `browser_scrape` | None |
| `email` | `email_send` | SMTP config in Settings |
| `notifications` | `notification_send` | None |

## Configuration

Config is stored at `~/.agent-smith/config.json`. Edit via UI only — never manually.

## Scheduled Tasks

Create tasks via chat:

```
You: Every day at 9am search for AI news and summarize it for me
Smith: Scheduled task "AI News Summary" created ✓ — every day at 09:00
```

Manage tasks in the **Scheduled Tasks** panel (clock icon in sidebar).

## Architecture

pnpm monorepo with four packages:

```
core/          — Agent logic, interfaces, memory, skill/extension loaders
transport/     — WebSocket server, REST API, file storage, cron scheduler
extensions/    — Pluggable tools (browser, email, notifications, storage)
cli/           — Entry point
ui/            — React frontend (Vite + Tailwind)
```

Three cloud-portable interfaces make the system easy to deploy anywhere:
- `IStorage` — local JSON files → DynamoDB in cloud
- `ITransport` — WebSocket → Lambda in cloud
- `IScheduler` — node-cron → EventBridge in cloud

## Development

```bash
pnpm install
pnpm build
pnpm dev        # Run in dev mode
pnpm test       # Run tests
```

## Uninstall

```bash
npm uninstall -g agent-smith
# Follow prompts to optionally delete user data (~/.agent-smith)
```

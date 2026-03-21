# LIMA — Long-term Intelligence Memory for Agents

LIMA is the memory system for created for Agent Smith. It replaces full conversation history replay with a smart fact store that loads only what's relevant to the current message.


## The problem

| Approach | Tokens (50-message session) |
|---|---|
| Full history replay | ~200,000 |
| Summarization | ~40,000 |
| **LIMA** | **~2,000** |

A standard conversation history grows without limit. After 50 messages, the agent carries ~200k tokens of context on every turn — most of it irrelevant. LIMA loads ~2,000 tokens of targeted facts instead.

## How it works

Every piece of memory is a **fact** — a short text with English tags, a scope, and a relevance score.

Before each agent turn, LIMA runs the **recall algorithm**:

```
User: "find me a remote Node.js job"
      ↓
Tags extracted: ["nodejs", "remote", "job"]
      ↓
Index lookup → "TypeScript developer, 3yr exp"  (matched 2 tags)
             → "prefers async work"              (matched 1 tag)
             → "meeting notes from Tuesday"      → not loaded
      ↓
Context: ~800 tokens of relevant facts only
```

## Scopes

| Scope | When loaded | Expires |
|---|---|---|
| `profile` | Every turn, always | Never |
| `knowledge` | On tag match only | Optional TTL |
| `working` | On tag match only | 24h default |
| `task` | Always while active | Required TTL |

- **profile** — who the user is, preferences, timezone. Max ~400 tokens.
- **knowledge** — documents, URLs, reference data ingested by the agent.
- **working** — short-lived session facts. What the agent found or decided this turn.
- **task** — active multi-step pipeline. Steps, status, checkpoint for resumption.

## Storage

```
~/.agent-smith/
└── lima.db     ← SQLite with FTS5 tag index. No server, no config.
```

Handles millions of facts with sub-millisecond tag lookup.

## Key patterns

**Extract Pattern** — after a tool returns large data, store only the relevant summary:
```
browser_scrape → 8,000 tokens of HTML
      ↓
store({ content: "Startup XYZ: founded 2023, $12M seed", scope: "working", tags: ["startup","xyz"] })
      ↓
Next turn sees 15 tokens, not 8,000
```

**Error Memory** — store failures so the agent doesn't retry dead ends:
```
crunchbase.com timeout → store({ content: "crunchbase timeout — skip this session", scope: "working" })
```

**Task Pipeline** — active task is always in context, agent tracks step-by-step progress with checkpoints.

## Architecture

```
@agent-smith/lima
├── ILimaMemory          interface — swap the implementation without touching the agent
├── LimaMemory           default implementation (SQLite + FTS5)
└── types                Fact, TaskFact, Scope, Source, RecallResult
```

The agent receives a `ILimaMemory` instance. To replace LIMA with a different memory backend, implement `ILimaMemory` and pass it in — nothing else changes.

## API

```typescript
// Store a fact
const id = await lima.store({
  content: "User is a TypeScript developer at a startup",
  scope:   "profile",
  source:  "user",
  weight:  0.9,
})

// Recall relevant facts for a query
const facts = await lima.recall("find Node.js jobs")
// → profile facts + active task + top matched facts (~800 tokens total)

// Task management
const taskId = await lima.startTask("Research AI startups", [
  { action: "search startups" },
  { action: "build report" },
])
await lima.updateTask(taskId, { steps: [...], checkpoint: { found: 7 } })

// Ingest a document
await lima.ingestFile("~/Documents/contract.pdf", { tags: ["contract"] })

// User-facing memory control
const facts = await lima.listMemory({ scope: "profile" })
await lima.deleteMemory("f_a3k9")
await lima.forget(0.10) // remove facts with weight below 0.10

// Maintenance (call after each agent turn)
await lima.decay()
```

# LIMA — Long-term Intelligence Memory for Agents

**Version:** 1.2.0-draft  
**Status:** Draft  
**Date:** 2026-03-20  
**License:** MIT

---

## Abstract

Large language models are stateless by nature. Every conversation starts fresh. Current solutions — full history replay, RAG, or naive summarization — either exhaust context windows or lose precision.

LIMA defines a structured memory protocol: a fact store, a tag-based index, and an associative recall algorithm. Only facts relevant to the current conversation enter the context window — everything else stays indexed and ready.

| Approach | Token cost (50-msg conversation) | Issues |
|---|---|---|
| Full history replay | ~200,000 tokens | Expensive, hits context limit |
| Summarization | ~40,000 tokens | Loses precision |
| RAG retrieval | ~8,000 tokens | Requires embeddings infrastructure |
| **LIMA recall** | **~2,000 tokens** | **Flat cost, scales with database size** |

> The ~2,000 token figure reflects a realistic deployment: profile (~200) + active task (~500) + recalled facts (~800) + system prompt (~500). Raw tool call results are processed per-turn and not accumulated.

LIMA works with any AI model, any programming language, and any database backend. It runs entirely locally with no external services required.

---

## Core Concepts

Every piece of memory is a **fact** — a discrete unit of information with tags, a scope, and a weight. The agent never loads all facts. On each turn it extracts tags from the incoming message, looks up matching facts in the index, and loads only the relevant subset into context.

```
User message: "find me a remote Node.js job"
      ↓
Tags: ["nodejs", "remote", "job"]
      ↓
Index lookup → "TypeScript developer, 3yr experience", "prefers async work"
      ↓
Unrelated facts ("meeting notes", "HR policy") → not loaded
      ↓
Context: ~800 tokens of relevant memory only
```

---

## Agent Scopes

Every fact has a `scope` that controls its lifecycle.

| Scope | Loaded | Decay | TTL |
|---|---|---|---|
| `profile` | Always, every turn | Never | Not applicable |
| `knowledge` | On recall match only | Never | Optional |
| `working` | On recall match only | × 0.85 per turn | Required |
| `task` | Always while `in_progress` or `paused` | Never (until completed/failed) | Required |

**`profile`** — who the user is. Name, preferences, timezone. Small (≤ 400 tokens total). Updated only by explicit user instruction or confirmed agent inference.

**`knowledge`** — documents, policies, reference data. Ingested from files, URLs, or folders. Loaded on demand by recall scoring only.

**`working`** — short-lived session context. What the agent found, tried, or decided this session. Expires via TTL (default 24h).

**`task`** — active multi-step pipeline state. Always in context while the task is running. See Task Fact below.

---

## Fact Schema

All LIMA implementations must use this schema exactly.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier, e.g. `f_a3k9` |
| `content` | string | ✓ | Full fact text, any language |
| `summary_en` | string | ✓ | One-line English summary for context injection |
| `summary_orig` | string | ✓ | Summary in the original input language |
| `tags` | string[] | ✓ | English semantic tags for index lookup |
| `scope` | enum | ✓ | `profile` / `knowledge` / `working` / `task` |
| `source` | enum | ✓ | See Source Types below |
| `weight` | float | ✓ | Long-term importance 0.0–1.0 |
| `activation` | float | ✓ | Current relevance 0.0–1.0, resets each turn |
| `created` | datetime | ✓ | ISO 8601 |
| `last_used` | datetime | ✓ | ISO 8601 |
| `use_count` | integer | ✓ | Times recalled |
| `ttl` | datetime | task/working | Expiry timestamp |
| `links` | string[] | — | IDs of associated facts for activation propagation |
| `chunk_index` | integer | — | Position in source document |
| `source_url` | string | — | Origin file path or URL |
| `viewed_by_user` | boolean | — | Whether the user has seen this fact via `listMemory` |

### Source Types

```
"user"           — explicitly stated by the user
"agent"          — inferred by the agent from conversation patterns
"conversation"   — extracted automatically from dialogue
"document"       — ingested from a local file
"webpage"        — ingested from a URL
"knowledge-base" — ingested from a folder
```

### Conflict Detection

When storing a new fact, implementations must check for conflicts before writing. A conflict is a new fact that contradicts an existing fact about the same entity.

```
New:      "User lives in Chicago"
Existing: "User lives in Seattle"  (source: "user", weight: 0.9)

→ do NOT silently overwrite
→ set conflict_with: ["f_b2m1"] on the new fact
→ surface the conflict to the agent before the next turn
```

### Example Facts

**Profile fact:**
```json
{
  "id":           "f_a3k9",
  "content":      "User works at a startup and writes TypeScript",
  "summary_en":   "Works at startup, writes TypeScript",
  "summary_orig": "Works at startup, writes TypeScript",
  "tags":         ["work", "startup", "typescript", "programming"],
  "scope":        "profile",
  "source":       "user",
  "weight":       0.85,
  "activation":   0.0,
  "created":      "2026-03-20T09:00:00Z",
  "last_used":    "2026-03-20T09:00:00Z",
  "use_count":    0,
  "viewed_by_user": true
}
```

**Working memory fact:**
```json
{
  "id":           "f_w_0017",
  "content":      "Searched for AI startups. Found 7 of 10. Crunchbase returned timeout.",
  "summary_en":   "Research progress: 7/10 found, crunchbase failed",
  "summary_orig": "Research progress: 7/10 found, crunchbase failed",
  "tags":         ["research", "startups", "progress", "crunchbase"],
  "scope":        "working",
  "source":       "agent",
  "weight":       0.7,
  "activation":   0.0,
  "ttl":          "2026-03-21T09:00:00Z",
  "created":      "2026-03-20T09:00:00Z",
  "last_used":    "2026-03-20T09:00:00Z",
  "use_count":    0,
  "viewed_by_user": false
}
```

**Knowledge chunk:**
```json
{
  "id":           "f_doc_0042",
  "content":      "Section 3.2: Employees are entitled to 28 days of annual leave per calendar year. Leave must be requested at least two weeks in advance using the HR portal.",
  "summary_en":   "28 days annual leave, 2 weeks advance notice required",
  "summary_orig": "28 days annual leave, 2 weeks advance notice required",
  "tags":         ["hr", "policy", "leave", "vacation"],
  "links":        ["f_doc_0041", "f_doc_0043"],
  "scope":        "knowledge",
  "source":       "knowledge-base",
  "weight":       0.90,
  "activation":   0.0,
  "chunk_index":  42,
  "source_url":   "./company-docs/hr-policy.pdf",
  "created":      "2026-03-20T09:00:00Z",
  "last_used":    "2026-03-20T09:00:00Z",
  "use_count":    0,
  "viewed_by_user": false
}
```

---

## Task Fact

A Task Fact has `scope: "task"` and tracks the state of a multi-step agent pipeline. It is always loaded in context while active.

| Field | Type | Description |
|---|---|---|
| `id` | string | Prefixed `t_`, e.g. `t_x9k2` |
| `goal` | string | Natural language objective |
| `status` | enum | `pending` / `in_progress` / `paused` / `completed` / `failed` |
| `steps` | Step[] | Ordered steps with individual status |
| `errors` | string[] | Tool failures this session |
| `checkpoint` | object? | Agent-defined state for resumption |
| `ttl` | datetime | Required |

**Step schema:** `action` (string), `status` (enum), `result` (string, optional)

```json
{
  "id":     "t_x9k2",
  "scope":  "task",
  "goal":   "Find 10 AI startups, build table, send to user email",
  "status": "in_progress",
  "steps": [
    { "action": "research startups", "status": "in_progress", "result": "7/10 found" },
    { "action": "build table",       "status": "pending" },
    { "action": "send email",        "status": "pending" }
  ],
  "errors": ["crunchbase.com timeout on 2026-03-20T09:14:00Z"],
  "checkpoint": {
    "found_so_far": ["OpenAI", "Mistral", "Cohere", "Adept", "Inflection", "Writer", "Imbue"]
  },
  "ttl": "2026-03-21T09:00:00Z",
  "source": "agent",
  "created": "2026-03-20T09:00:00Z",
  "last_used": "2026-03-20T09:00:00Z"
}
```

---

## Recall Algorithm

Runs once per conversation turn before calling the AI model.

**Step 1 — Profile load.** Load all `profile` facts unconditionally.

**Step 2 — Active task load.** If a task has `status: "in_progress"` or `"paused"`, load it unconditionally.

**Step 3 — Topic shift detection.** Compare tags of the current message against tags of the previous turn.

```
overlap = |current_tags ∩ previous_tags| / |current_tags ∪ previous_tags|

overlap < 0.20  →  reset all working and knowledge activations to 0.0
```

This immediately clears irrelevant context when the user changes topic, instead of waiting for slow decay.

**Step 4 — Tag extraction.** Extract English semantic tags from the current message.

```
Single language  →  local NLP library (0 extra tokens)
Mixed language   →  tags extracted inside the main AI response (~30 extra tokens)
Never            →  a separate API call for tag extraction alone
```

**Step 5 — Index lookup.** Score facts by how many query tags they match.

```
Tags: ["nodejs", "remote", "job"]

index["nodejs"] → [f_a3k9, f_x7z2]
index["remote"] → [f_a3k9, f_c4p7]
index["job"]    → [f_a3k9, f_b2m1]

f_a3k9 matched 3 → score 3
f_c4p7 matched 1 → score 1
f_b2m1 matched 1 → score 1
```

**Step 6 — Activation propagation.** Propagate activation through fact links up to depth 3.

```
f_a3k9 → activation 1.0
  └─ f_b2m1 → 1.0 × 0.7 = 0.70
  └─ f_c4p7 → 1.0 × 0.7 = 0.70
       └─ f_x7z2 → 0.70 × 0.5 = 0.35
```

Links are optional. Facts without links are scored by tag intersection only.

**Step 7 — Context assembly.** Select top 12 facts by activation score. Hard limit: ~800 tokens for recalled facts.

```
[profile]   Alex, TypeScript developer, prefers concise answers
[task]      Goal: find 10 AI startups. Step 1: 7/10 found. Step 2: pending.
[working]   Crunchbase timeout. Draft saved to /tmp/results.csv.
[knowledge] HR policy: 28 days leave, 2 weeks notice.
```

**Step 8 — Decay.** After the AI response is sent, apply decay to `working` and `knowledge` activations.

```
activation × 0.85
activation < 0.10  →  reset to 0.0
```

`profile` and active `task` facts are never decayed.

---

## Protocol Methods

### Required (15 methods)

---

#### `lima.store(fact) → id`

Persist a new fact. Tags are generated automatically if not provided. Checks for conflicts before writing.

```typescript
const id = await lima.store({
  content: "User works at a startup in San Francisco",
  scope:   "profile",
  source:  "user",
  weight:  0.9,
});
```

---

#### `lima.recall(query) → Fact[]`

Run the full recall algorithm. Returns profile facts + active task + top recalled facts, ordered by activation.

```typescript
const facts  = await lima.recall("find me a remote job");
const memory = facts.map(f => f.summary_en).join("\n");
```

---

#### `lima.decay() → void`

Apply the decay multiplier to all `working` and `knowledge` activations. Call once per turn after the AI response is sent.

```typescript
await lima.decay();
```

---

#### `lima.forget(threshold) → number`

Remove facts with `weight` below the threshold. Returns count removed. `profile` facts are excluded — delete those explicitly. Recommended: run periodically with `threshold: 0.10`.

```typescript
const removed = await lima.forget(0.10);
```

---

#### `lima.resetContext() → void`

Force-reset all `working` and `knowledge` activations to 0.0. For use when the agent detects an explicit topic change beyond what automatic detection catches.

```typescript
await lima.resetContext();
```

---

#### `lima.startTask(goal, steps, options?) → task_id`

Create a Task Fact and set it to `in_progress`. Only one task may be active at a time — starting a new task automatically pauses the current one.

```typescript
const taskId = await lima.startTask(
  "Find 10 AI startups, build table, send email",
  [
    { action: "research startups" },
    { action: "build table" },
    { action: "send email" },
  ],
  { ttl: "24h" }
);
```

---

#### `lima.updateTask(task_id, patch) → void`

Update fields on an active task after a step completes or produces a checkpoint.

```typescript
await lima.updateTask("t_x9k2", {
  steps: [
    { action: "research startups", status: "completed", result: "10/10 found" },
    { action: "build table",       status: "in_progress" },
    { action: "send email",        status: "pending" },
  ],
  checkpoint: { table_path: "/tmp/results.csv" },
});
```

---

#### `lima.getActiveTask() → Task | null`

Return the currently active task, or null.

```typescript
const task = await lima.getActiveTask();
if (task) {
  const next = task.steps.find(s => s.status === "pending");
}
```

---

#### `lima.ingestFile(path, options?) → number`

Parse a local file, chunk it, extract tags per chunk, store all chunks as `knowledge` facts. Returns facts created.

Supported: `.pdf`, `.txt`, `.md`, `.docx`. Implementations may extend this list.

```typescript
const count = await lima.ingestFile("./contract.pdf", {
  chunkSize:    200,   // words per chunk
  chunkOverlap: 20,
  tags:         ["contract", "legal"],
  weight:       0.9,
});
```

---

#### `lima.ingestURL(url, options?) → number`

Fetch a URL, extract clean text, chunk and store as `knowledge` facts.

```typescript
const count = await lima.ingestURL("https://docs.example.com/api", {
  depth:  2,
  tags:   ["documentation", "api"],
  weight: 0.85,
});
```

---

#### `lima.ingestFolder(path, options?) → number`

Recursively process all supported files in a directory.

```typescript
const count = await lima.ingestFolder("./company-docs/", {
  extensions: [".md", ".txt", ".pdf"],
  recursive:  true,
  tags:       ["company", "internal"],
  weight:     0.9,
});
```

---

#### `lima.link(id1, id2) → void`

Create a bidirectional association between two facts for activation propagation.

```typescript
await lima.link("f_a3k9", "f_b2m1");
```

---

#### `lima.listMemory(filter?) → Fact[]`

Return facts visible to the user. Used to let users inspect what the agent knows about them.

Filter options: `scope`, `source`, `since` (datetime), `limit`.

```typescript
// Show the user their profile and agent-inferred facts
const facts = await lima.listMemory({ scope: "profile" });
const inferred = await lima.listMemory({ source: "agent" });
```

Facts returned by `listMemory` have `viewed_by_user` set to `true`.

---

#### `lima.deleteMemory(id | filter) → number`

Delete one fact by ID, or all facts matching a filter. Returns count deleted. This is the user-facing delete — it bypasses weight threshold.

```typescript
// Delete a single fact
await lima.deleteMemory("f_a3k9");

// Delete all agent-inferred facts
await lima.deleteMemory({ source: "agent" });

// Delete all facts for a specific document
await lima.deleteMemory({ source_url: "./company-docs/old-policy.pdf" });
```

---

#### `lima.get(id) → Fact`

Retrieve a single fact by ID.

```typescript
const fact = await lima.get("f_a3k9");
```

---

### Optional Methods

Implementations may provide these. If provided, signatures must match.

| Method | Returns | Description |
|---|---|---|
| `lima.search(query, limit?)` | `Fact[]` | Full-text search without activation scoring |
| `lima.update(id, patch)` | `void` | Update fields on an existing fact |
| `lima.stats()` | `Stats` | Fact counts, storage size, average weight |
| `lima.export(path)` | `void` | Export all facts to JSON |
| `lima.import(path)` | `number` | Import facts from a JSON export |
| `lima.summarizeSession(transcript)` | `void` | Extract and store key facts from a completed session |

---

## User Control

Users must be able to inspect and remove what the agent remembers. Implementations must support this flow.

**Viewing memory:**
```
User: "What do you remember about me?"

Agent calls: lima.listMemory({ scope: "profile" })
             lima.listMemory({ source: "agent" })

Agent responds:
  "Here is what I know about you:
   - You work at a startup and write TypeScript  [stored by you]
   - You prefer concise answers  [stored by you]
   - You frequently ask about React  [inferred by me]

   You can ask me to forget any of these."
```

**Deleting memory:**
```
User: "Forget that I work at a startup"

Agent calls: lima.deleteMemory("f_a3k9")

Agent responds: "Done. I've removed that."
```

**Clearing inferred facts:**
```
User: "Remove everything you inferred about me"

Agent calls: lima.deleteMemory({ source: "agent" })
```

Agents must not resist or delay memory deletion requests. Deletion is immediate and irreversible.

---

## Agent Patterns

Conventions for agent implementations. Not protocol requirements.

### Extract Pattern

After every tool call that returns large data, extract only the relevant information and store it as a `working` fact. Do not carry raw results across turns.

```typescript
// Tool returns 8,000 tokens of raw HTML
const rawPage = await browser.fetch("https://example.com/startup");

// Store only what matters
await lima.store({
  content: "Startup XYZ: founded 2023, AI infrastructure, $12M seed",
  scope:   "working",
  source:  "agent",
  tags:    ["startup", "xyz", "funding", "ai"],
  ttl:     "24h",
});

// Next turn sees ~20 tokens, not 8,000
```

### Error Memory Pattern

When a tool fails, store the failure so the agent does not retry the same dead end.

```typescript
try {
  await browser.fetch("https://crunchbase.com/startups");
} catch (e) {
  await lima.store({
    content: "crunchbase.com timeout — do not retry this session",
    scope:   "working",
    source:  "agent",
    tags:    ["crunchbase", "error", "timeout"],
    ttl:     "24h",
  });
}
```

### Task Pipeline Pattern

Check the active task at the start of each turn. Update it after each step.

```typescript
async function agentTurn(userMessage: string): Promise<string> {
  const facts  = await lima.recall(userMessage);
  const task   = await lima.getActiveTask();
  const memory = buildContextBlock(facts, task);

  const response = await model.complete({ system: memory, message: userMessage });

  await extractAndStore(response);
  if (task) await updateTaskFromResponse(task, response);
  await lima.decay();

  return response.text;
}
```

---

## Storage

### Default — SQLite only

```
~/.lima/
└── facts.db      ← facts table + FTS tag index
```

Handles ~10 million facts with sub-millisecond tag lookup. No server, no configuration.

### Extended — SQLite + LanceDB

```
~/.lima/
├── facts.db      ← facts + tag index
└── vectors.db    ← semantic similarity (local, no API)
```

LanceDB activates when tag lookup returns fewer than 3 results.

### Storage estimates

| Source | Approximate facts | `facts.db` size |
|---|---|---|
| 100-page PDF | ~500 | ~2 MB |
| 1,000-page document | ~5,000 | ~18 MB |
| Company knowledge base (500 docs) | ~25,000 | ~30 MB |

---

## Multilingual Support

Tags are always stored in English regardless of input language. `content` and `summary_orig` preserve the original language unchanged.

```
Input:  "I want Node.js jobs near me"       → tags: ["nodejs", "job", "work"]
Input:  "cherche emploi développeur React"  → tags: ["react", "job", "developer"]
Input:  "Node.js の仕事を探しています"       → tags: ["nodejs", "job", "work"]
```

Tag extraction: local NLP for single-language input (0 extra tokens), inline AI extraction for mixed-language input (~30 extra tokens). Never a separate API call.

---

## Architecture

```
┌──────────────────────────────────────┐
│            AI Model                  │
│   (Claude / GPT / Gemini / Ollama)   │
└───────────────┬──────────────────────┘
                │  ~2,000 token context block
                ▼
┌──────────────────────────────────────┐
│          LIMA Context Builder        │
│  profile (always)      ≤ 400 tokens  │
│  active task (if any)  ≤ 500 tokens  │
│  recalled facts        ≤ 800 tokens  │
│  system prompt         ≤ 500 tokens  │
└───────┬──────────┬─────────┬─────────┘
        ▼          ▼         ▼
  ┌──────────┐ ┌────────┐ ┌────────────┐
  │  Layer 1 │ │Layer 2 │ │  Layer 3   │
  │Fact Store│ │  Tag   │ │ Semantic   │
  │ SQLite   │ │ Index  │ │  Search    │
  │          │ │  FTS   │ │  LanceDB   │
  └──────────┘ └────────┘ └────────────┘
```

---

## Language Implementations

LIMA is a protocol. The fact schema and the 15 required methods are the complete contract. Any language can implement it.

| Language | Package | Status |
|---|---|---|
| TypeScript | `@lima/core` | Reference implementation |
| Python | `lima-python` | Planned |
| Go | `github.com/lima/go` | Planned |
| Rust | `lima-rs` | Planned |
| Swift | `LIMAKit` | Planned |
| Kotlin | `lima-kotlin` | Planned |

All implementations share the same SQLite schema. A fact written by a Python agent is readable by a TypeScript agent without conversion.

---

## Design Decisions

**Why SQLite and not a vector database by default?**  
Vector search requires embeddings — an API call or a local model. SQLite tag lookup requires nothing. The implementation must work fully offline. LanceDB is additive.

**Why are tags always in English?**  
The index must be language-neutral. English is the dominant training language of most models and the only practical universal tag namespace.

**Why dynamic top-N instead of a fixed activation threshold?**  
A fixed threshold produces unpredictable context sizes as the database grows. Top-N keeps the context block within budget regardless of database size.

**Why topic shift detection instead of decay alone?**  
Decay at ×0.85 takes 7+ turns to clear a high-activation fact. When a user changes topic abruptly, topic shift detection provides an immediate reset at the cost of one set comparison.

**Why separate `weight` and `activation`?**  
`weight` is long-term importance — hard to lose, grows with use. `activation` is per-turn relevance — resets every turn. A single value cannot serve both roles correctly.

**Why four scopes?**  
Profile, knowledge, working, and task facts have fundamentally different lifecycles. A single decay model cannot serve all four.

---

## Glossary

**Fact** — a unit of memory: a personal note, a document chunk, a working observation, or a task.

**Scope** — lifecycle category: `profile`, `knowledge`, `working`, `task`.

**Tag** — a short English keyword used to index and retrieve a fact.

**Activation** — per-turn relevance score (0.0–1.0). Resets and propagates each turn, decays after.

**Weight** — long-term importance (0.0–1.0). Grows with use.

**Decay** — multiplying working/knowledge activations by 0.85 at end of turn.

**Topic Shift** — tag overlap < 20% between turns. Triggers immediate activation reset.

**TTL** — expiry datetime. Required for `working` and `task` facts.

**Extract Pattern** — distilling large tool results into small working facts instead of carrying raw data across turns.

---

*LIMA — Long-term Intelligence Memory for Agents · v1.2.0-draft · MIT License*

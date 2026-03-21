---
name: memory
description: Remember important facts about the user and recall them in future conversations using LIMA long-term memory
---

You have a long-term memory system (LIMA) accessible via tools: `memory_store`, `memory_list`, `memory_delete`.

## When to store facts proactively

**Profile facts** (`scope: profile`) — user identity, preferences, recurring context:
- Name, location, timezone, occupation
- Stated preferences ("I prefer X over Y", "always use TypeScript")
- Explicit instructions for future behavior ("from now on, always...")
- Communication style preferences

**Knowledge facts** (`scope: knowledge`) — reference data the user wants you to remember:
- Domain-specific terminology or rules the user explained
- Project context, tech stack, architecture decisions
- Documents or URLs the user asked you to remember

**Working facts** (`scope: working`) — findings from the current session:
- Results of research or web searches worth keeping
- Decisions made during a task
- Intermediate results of multi-step work

## When NOT to store

- Trivial conversational exchanges ("hello", "thanks")
- Information the user can easily look up themselves
- Sensitive data (passwords, secrets, financial details)
- Anything the user hasn't explicitly shared or confirmed

## How to use

```
# Remember a preference
memory_store(content="User prefers dark mode and concise answers", scope="profile")

# Remember a project fact
memory_store(content="Project uses pnpm monorepo with TypeScript strict mode", scope="knowledge", tags=["project", "typescript", "pnpm"])

# List what you know about the user
memory_list(scope="profile")

# Delete an outdated fact
memory_delete(id="f_a3k9")
```

## Response behavior

- After storing: confirm briefly — "Got it, I'll remember that."
- When recalling: use the information naturally without saying "according to my memory..."
- If asked "do you remember X?": use `memory_list` to check, then be honest if not found
- Profile facts are always injected into context automatically — no need to recall them manually

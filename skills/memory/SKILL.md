---
name: memory
description: Remember important facts about the user and recall them in future conversations using LIMA long-term memory
---

You have a long-term memory system (LIMA) accessible via tools: `memory_store`, `memory_list`, `memory_delete`, `document_search`, `document_list`.

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

## How to use memory tools

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

## Document search

When the user asks about content from an uploaded file, use `document_search` to find relevant passages:

```
# Search across all indexed documents
document_search(query="project requirements")

# List available documents first
document_list()

# Then search for specific content
document_search(query="authentication flow", limit=4)
```

**When to use `document_search`:**
- User asks "what does this file say about X?"
- User uploads a document and asks questions about it
- User refers to content from a previously attached file
- You need to verify something from indexed documents

**Citation rule:** When answering from a document, always mention the source:
> "According to **report.pdf**: ..."
> "From **spec.docx**: ..."

## Response behavior

- After storing: confirm briefly — "Got it, I'll remember that."
- When recalling: use the information naturally without saying "according to my memory..."
- If asked "do you remember X?": use `memory_list` to check, then be honest if not found
- Profile facts are always injected into context automatically — no need to recall them manually
- Document chunks in context are prefixed with `[doc:filename]` — cite that filename in your answer

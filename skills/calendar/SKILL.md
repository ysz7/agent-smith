---
name: calendar
description: Smart calendar — schedule one-time events and recurring tasks in natural language with conflict detection
requires:
  extensions:
    - calendar
---

You manage two types of schedule entries:

| Type | Storage | Tool |
|---|---|---|
| **One-time event** | Calendar (persistent) | `calendar_add` + `task_create` |
| **Recurring task** | Scheduler | `task_create` only |

## Creating a one-time event

When user says: "встреча завтра в 15:00", "appointment on Friday at 10", "zoom call next Monday 14:30"

**Step 1** — call `calendar_add` with:
- `title`: short event name
- `datetime`: ISO 8601 (e.g. `"2026-03-24T15:00:00"`)
- `duration`: minutes (ask if unclear, default 60)
- `description`: agenda or notes if provided

The tool returns:
- `id` — event id
- `cron` — ready-made cron expression for the reminder
- `conflicts` — list of overlapping events (may be empty)

**Step 2** — if there are conflicts, warn the user:
> "⚠ Conflict: you already have **{title}** at {time}. Proceed?"

**Step 3** — call `task_create` with:
- `name`: same as event title
- `cron`: the cron value from step 1
- `instructions`: `"Remind the user: {title} is starting now."`

**Step 4** — call `calendar_update` with `id` and `taskId` from task_create to link them.

**Step 5** — confirm:
> "📅 **{title}** — {date} at {time} ({duration} min)"

## Creating a recurring task

When user says: "remind me every Monday", "check email daily at 9am"

Call `task_create` only — no calendar entry needed.

## Natural language → datetime rules

Today is injected in the system prompt. Use it as the reference point.

| User says | Parse as |
|---|---|
| "tomorrow at 3pm" | next day, 15:00 |
| "next Monday" | nearest upcoming Monday, 09:00 if no time given |
| "in 2 hours" | now + 2h, round to nearest 5 min |
| "Friday at 10:30" | nearest upcoming Friday, 10:30 |
| "March 25 at noon" | 2026-03-25T12:00:00 |
| "tonight at 8" | today, 20:00 |
| "end of week" | Friday, 18:00 |

Always confirm your interpretation before creating: "I'll schedule this for **Tuesday March 25 at 15:00** — correct?"

## Listing events

When user asks "what's on my calendar", "my schedule", "upcoming events":

Call `calendar_list` (default: next 30 days). Format as:
```
📅 Today
  • 15:00 — Team meeting (1h)

📅 Tomorrow
  • 10:00 — Doctor appointment (30 min)
```

## Deleting / rescheduling

- **Delete**: call `calendar_delete` → returns `taskId` → also call `task_delete` with that taskId
- **Reschedule**: call `calendar_update` with new datetime → it returns `newCron` → call `task_delete` on old task, then `task_create` with newCron, then `calendar_update` with new taskId

## Rules

- Never guess the year — if the date has passed this year, assume next year
- If time zone matters, ask the user
- For events under 15 min, suggest they're probably reminders, not meetings
- Never create duplicate events — check `calendar_list` first if unsure

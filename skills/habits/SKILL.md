---
name: habits
description: Track daily habits — mark completions, view streaks and statistics
requires:
  extensions:
    - storage
---

You can track habits using storage tools. All habit data is stored under the prefix `habits:`.

**Storage structure:**
- `habits:list` — array of habit definitions: `[{ id, name, createdAt }]`
- `habits:log:<YYYY-MM-DD>` — array of completed habit IDs for that day: `["gym", "reading"]`

**Use these actions:**

Add a habit — when user says "добавь привычку", "track habit", "хочу следить за":
1. `storage_get("habits:list")` to load existing list
2. Add new entry with a short slug id (e.g. "gym", "reading", "water")
3. `storage_set("habits:list", updatedList)`

Mark done — when user says "сделал", "отметь", "выполнил", "done":
1. Determine today's date (ISO: YYYY-MM-DD)
2. `storage_get("habits:log:<today>")` → add the habit id → `storage_set`

Show today's status — when user asks "что сегодня", "my habits today":
1. `storage_get("habits:list")` and `storage_get("habits:log:<today>")`
2. Show each habit with ✓ or ✗ (use plain - done / - pending if no emojis in style)

Show statistics — when user asks "статистика", "streak", "сколько дней подряд":
1. Load logs for the last 30 days
2. Calculate streak (consecutive days with habit completed) and completion rate

Delete habit — when user says "удали привычку":
1. Remove from `habits:list`

**Response format:**
- Today's status: one habit per line — name and done/pending
- Streak: "<habit>: X days in a row"
- Keep it short — no lengthy explanations

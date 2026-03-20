---
name: expenses
description: Track personal expenses — add, list, and summarize spending
requires:
  extensions:
    - storage
---

You can track expenses using storage tools. All data stored under prefix `expenses:`.

**Storage structure:**
- `expenses:log:<YYYY-MM>` — array of expense entries for that month:
  `[{ id, date, amount, currency, category, note }]`

**Categories (auto-detect from context):**
food, transport, entertainment, health, shopping, housing, subscriptions, other

**Actions:**

Add expense — when user says "потратил", "купил", "заплатил", "spent", "add expense":
1. Parse: amount, currency (default: user's likely currency), category, note
2. `storage_get("expenses:log:<YYYY-MM>")` → append → `storage_set`
3. Confirm: "Added: 500 UAH — food (lunch)"

Show summary — when user asks "сколько потратил", "expenses this month", "итого":
1. `storage_get("expenses:log:<current-month>")`
2. Group by category, sum totals
3. Show breakdown — one category per line

Show history — when user asks about a specific month or period:
1. Load relevant month logs
2. List entries or show summary

Delete last — when user says "удали последнее", "undo":
1. Load current month log, remove last entry, save

**Response format for summary:**
  Food          1,200 UAH
  Transport       450 UAH
  Entertainment   800 UAH
  ─────────────────────
  Total         2,450 UAH

For adding: single confirmation line, no extra commentary.

---
name: reminders
description: Set reminders and recurring alerts via the scheduler
requires:
  extensions:
    - storage
---

You can create reminders using the task scheduler tools (`task_create`, `task_list`, `task_delete`).

**Use this skill when the user says:**
- "напомни", "remind me", "не дай забыть"
- "каждый день в X", "every Monday", "по пятницам"
- "через X минут/часов", "in X minutes"

**One-time reminders ("через 30 минут", "at 18:00"):**
Use `task_create` with a cron expression for the specific time.
- "в 18:00" → cron: `0 18 * * *` (daily at 18:00, user can delete after it fires)
- "каждый день в 9:00" → cron: `0 9 * * *`
- "каждый понедельник в 10:00" → cron: `0 10 * * 1`
- "по будням в 8:30" → cron: `30 8 * * 1-5`
- "каждый час" → cron: `0 * * * *`

**Cron format:** `minute hour day month weekday`
- Weekdays: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

**When creating a reminder:**
1. Parse the time/recurrence from user's message
2. Call `task_create` with:
   - name: short description of the reminder
   - cron: correct cron expression
   - instructions: "Remind the user: <what to remind>"
3. Confirm: "Reminder set: <description> at <time>"

**List reminders** — when user asks "мои напоминания", "show reminders":
Call `task_list` and show only reminder tasks.

**Delete reminder** — when user says "удали напоминание":
Call `task_list` to find it, then `task_delete`.

**Response:**
- Confirmation: one line — "Напоминание: <текст> в <время>"
- Never explain cron syntax to the user

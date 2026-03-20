---
name: calendar
description: Create and manage scheduled tasks that run automatically
---

You can create scheduled tasks that run automatically on a schedule.

When the user asks you to do something repeatedly or at a specific time:
1. Understand the task: what to do, when, and how often
2. Parse the schedule into a cron expression (e.g., "every day at 9am" → "0 9 * * *")
3. Create the scheduled task and confirm with the user

Common cron patterns:
- Every day at 9am: `0 9 * * *`
- Every Monday at 8am: `0 8 * * 1`
- Every hour: `0 * * * *`
- Every 30 minutes: `*/30 * * * *`

When creating a task:
- Ask for clarification if the schedule is ambiguous
- Show the user what you understood: "Every day at 9:00 AM"
- Confirm the task was created: "Scheduled task created ✓"

After a scheduled task runs:
- Report the result back to the user
- Log any errors clearly

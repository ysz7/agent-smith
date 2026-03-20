---
name: email
description: Send emails via configured SMTP
requires:
  extensions:
    - email
---

You can send emails using the `email_send` tool.

**Use `email_send` when the user asks to send an email, "отправь письмо", "send email".**

**Parameters:**
- `to` — recipient email address
- `subject` — subject line
- `body` — plain text body
- `html` — optional HTML body

**If the tool returns a configuration error (missing host/user/password):**
Tell the user:
"Email is not configured yet. To enable it, go to Settings → Extensions → email and set:
  - host: your SMTP server (e.g. smtp.gmail.com)
  - port: 587
  - user: your email address
  - password: your app password
  - from: your email address (optional)"

**Never say you cannot send email without trying the tool first.**

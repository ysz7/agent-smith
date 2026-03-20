---
name: notes
description: Save, retrieve, search and delete personal notes
requires:
  extensions:
    - storage
---

You can save and retrieve personal notes using storage tools. Notes are stored with the prefix `notes:`.

**Use `storage_set` to save a note:**
- Key format: `notes:<short-slug>` (e.g. `notes:wifi-password`, `notes:meeting-2024-03-20`)
- Value: plain text string only — never JSON objects
- Example: `storage_set("notes:wifi-password", "12345")`

**Use `storage_list` with prefix `notes:` to list all notes**

**Use `storage_get` to retrieve a specific note**

**Use `storage_delete` to delete a note**

**Behavior:**
- When the user says "remember", "note", "save", "запомни", "запиши" → save a note
- When the user asks about something they noted → use `storage_list` to find the right key, then `storage_get`
- Generate a meaningful slug from the content (e.g. "wifi password" → `notes:wifi-password`)
- Never say you can't save information — you have storage tools, use them
- Never say you can't save information — you have storage tools, use them

**Response after retrieving:**
- Just state the value directly. Do NOT repeat it or add "Here is what I found:".
- Example: user asks "what's my wifi password" → you get "12345" → reply: "Пароль от WiFi: 12345."

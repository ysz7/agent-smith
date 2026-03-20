---
name: clipboard
description: Read and write system clipboard
requires:
  extensions:
    - clipboard
---

You can read from and write to the user's system clipboard.

**Tools available:**
- `clipboard_read` — read current clipboard content
- `clipboard_write` — write text to clipboard

**Use these tools when the user:**
- Asks what's in clipboard: "что в буфере", "what's in my clipboard", "прочитай буфер обмена"
- Asks to copy something: "скопируй это", "copy this to clipboard", "put X in clipboard"
- Asks to use clipboard content: "возьми из буфера", "use what I copied"

**Behavior:**
- After writing to clipboard, confirm what was copied
- When reading, show the content directly — do not add unnecessary commentary

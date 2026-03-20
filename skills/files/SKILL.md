---
name: files
description: Read, write, list and search files on disk
requires:
  extensions:
    - files
---

You can work with files on the user's disk using file tools.

**Tools available:**
- `file_read` — read a file's contents
- `file_write` — write or append content to a file (creates missing directories automatically)
- `file_list` — list files in a directory, optionally filtered by name/extension
- `file_search` — recursively search for files by name pattern
- `file_delete` — delete a file

**Use these tools when the user:**
- Asks to read, open, or show a file: "прочитай этот файл", "open ~/Documents/report.txt"
- Asks to create or save a file: "создай файл", "запиши это в файл", "save to desktop"
- Asks to find files: "найди все PDF в Downloads", "find photos on my desktop"
- Asks to list directory contents: "что в папке Documents", "list my downloads"
- Asks to delete a file: "удали этот файл"

**Path rules:**
- Always use `~` for home directory paths when the user says "desktop", "downloads", etc.
- Desktop: `~/Desktop`, Downloads: `~/Downloads`, Documents: `~/Documents`
- Windows paths like `C:\Users\...` are also valid

**Safety:**
- Never delete files without explicit user confirmation
- When writing, confirm what was written and where
- When reading large files, summarize the content rather than dumping all of it

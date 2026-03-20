---
name: summarize
description: Summarize any URL or pasted text
requires:
  extensions:
    - browser
---

You can summarize web pages and long texts.

**When the user pastes a URL and asks to summarize:**
1. Call `browser_scrape` on the URL
2. Summarize the content clearly: main point, key facts, conclusion
3. Keep the summary concise (3-7 sentences unless asked for more)

**When the user pastes a long text:**
- Summarize directly without any tools — just process the text

**When the user asks "о чём эта статья", "суммаризируй", "кратко", "tl;dr":**
- If a URL is present → scrape and summarize
- If text is pasted → summarize directly

**Output format:**
- One paragraph summary
- Then 3-5 key bullet points if content warrants it
- Cite the source URL

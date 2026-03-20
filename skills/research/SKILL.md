---
name: research
description: Deep research on any topic — searches multiple sources and returns a structured report
requires:
  extensions:
    - browser
---

You can do deep research using `browser_search` and `browser_scrape`.

**Use this skill when the user asks for:**
- In-depth research on a topic: "изучи", "research", "найди всё о", "сделай обзор"
- Comparison of options: "сравни X и Y", "compare these"
- Fact-checking or detailed background on something

**Research process:**
1. Run 2-3 `browser_search` queries covering different angles of the topic
2. `browser_scrape` the 2-3 most relevant URLs from results for full content
3. Synthesize into a structured report

**Report format (plain text, no tables, no dividers):**

Topic: <topic>

Summary
<2-3 sentence overview of the key finding>

Key points
- <point one>
- <point two>
- <point three>

Sources
- <Title> — <url>
- <Title> — <url>

Keep the report concise and factual. Do not pad with filler sentences.
If search returns no results, say so and suggest rephrasing.

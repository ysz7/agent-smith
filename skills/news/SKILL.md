---
name: news
description: Search for latest news on any topic
requires:
  extensions:
    - browser
---

You can fetch latest news using `browser_search`.

**When the user asks about news, current events, "что происходит", "последние новости":**
1. Call `browser_search` with query: `<topic> news today` or `latest <topic> news`
2. Present results as a clean list: headline, source, brief description
3. If the user wants more detail on a specific article → call `browser_scrape` on that URL

**Always use `browser_search` for news — never rely on training data for current events.**

**Output format:**
  Topic: <topic>

  1. <Headline> — <Source>
     <One sentence description>

  2. <Headline> — <Source>
     <One sentence description>

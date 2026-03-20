---
name: web-search
description: Search the internet for up-to-date information
requires:
  extensions:
    - browser
config:
  maxResults: 10
---

You have real-time internet access via the `browser_search` and `browser_scrape` tools. Use them proactively.

**Always use `browser_search` when:**
- The user asks about prices, rates, or any live data (crypto, stocks, currency, etc.)
- The user asks about current events, news, or anything that changes over time
- The user asks "what is", "how much", "latest", "current", "today", "now"
- Your training data may be outdated for the topic

**Never say** "I don't have internet access" or "I can't check" — you have `browser_search`. Use it.

**How to search:**
1. Call `browser_search` with a concise English query
2. If results are insufficient, call `browser_scrape` on the most relevant URL for full content
3. Summarize findings clearly, cite sources with titles and URLs
4. If no results found, refine the query and try once more

**For crypto prices:** search `"bitcoin price usd site:coinmarketcap.com"` or `"ethereum price usd"` — then scrape the result URL if needed.

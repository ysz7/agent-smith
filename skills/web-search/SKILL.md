---
name: web-search
description: Search the internet for up-to-date information
requires:
  extensions:
    - browser
config:
  maxResults: 10
---

When the user asks for information that may require searching the internet:

1. Use the `browser_search` tool with a concise search query
2. Review the results and pick the most relevant ones (up to maxResults)
3. Summarize the findings clearly, citing sources with titles and URLs
4. If the first search is insufficient, refine and search again

Guidelines:
- Always cite your sources
- Prefer recent results for time-sensitive questions
- If no relevant results found, say so and suggest the user search directly

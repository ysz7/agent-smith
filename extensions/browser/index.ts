import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ExtensionAPI } from '@agent-smith/core'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'browser_search',
    description: 'Search the web using DuckDuckGo and return top results with titles, URLs, and snippets',
    parameters: {
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum number of results to return (default: 5, max: 10)' },
      },
      required: ['query'],
    },
    run: async ({ query, maxResults = 5 }: { query: string; maxResults?: number }) => {
      const limit = Math.min(maxResults, 10)
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
      })

      const $ = cheerio.load(response.data)
      const results: Array<{ title: string; url: string; snippet: string }> = []

      $('.result').each((_i, el) => {
        if (results.length >= limit) return false

        const titleEl = $(el).find('.result__title a')
        const snippetEl = $(el).find('.result__snippet')
        const title = titleEl.text().trim()
        const href = titleEl.attr('href') ?? ''
        const snippet = snippetEl.text().trim()

        // DuckDuckGo wraps links in a redirect — extract the actual URL
        let resultUrl = href
        try {
          const parsed = new URL(href, 'https://duckduckgo.com')
          resultUrl = parsed.searchParams.get('uddg') ?? href
        } catch {
          // Use href as-is
        }

        if (title) {
          results.push({ title, url: resultUrl, snippet })
        }
      })

      if (results.length === 0) {
        return { message: 'No results found. Try a different query.' }
      }

      return results
    },
  })

  api.registerTool({
    name: 'browser_scrape',
    description: 'Fetch a web page URL and return its cleaned text content (scripts and styles removed)',
    parameters: {
      properties: {
        url: { type: 'string', description: 'The URL to fetch and extract text from' },
        maxLength: { type: 'number', description: 'Maximum characters to return (default: 8000)' },
      },
      required: ['url'],
    },
    run: async ({ url, maxLength = 8000 }: { url: string; maxLength?: number }) => {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024, // 5 MB limit
      })

      const $ = cheerio.load(response.data)

      // Remove noise elements
      $('script, style, nav, footer, header, iframe, noscript, [hidden]').remove()

      const text = $('body')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)

      return { url, content: text, truncated: text.length >= maxLength }
    },
  })
}

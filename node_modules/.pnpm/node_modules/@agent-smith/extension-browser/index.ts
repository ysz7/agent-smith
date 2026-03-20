import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ExtensionAPI } from '@agent-smith/core'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'browser_search',
    description: 'Search the web via Tavily and return top results with titles, URLs, and content snippets',
    parameters: {
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 5, max: 10)' },
      },
      required: ['query'],
    },
    run: async ({ query, maxResults = 5 }: { query: string; maxResults?: number }) => {
      const extConfig = (api.config.extensions['browser']?.config ?? {}) as Record<string, string>
      const apiKey = extConfig.tavilyApiKey

      if (!apiKey) {
        return { error: 'Web search requires a Tavily API key. Add it in Settings → Extensions → browser → Configure. Free key at app.tavily.com (1000 searches/month).' }
      }

      const response = await axios.post('https://api.tavily.com/search', {
        api_key: apiKey,
        query,
        max_results: Math.min(maxResults, 10),
        search_depth: 'basic',
        include_answer: false,
      }, { timeout: 15000 })

      const results = response.data?.results as Array<{
        title: string
        url: string
        content?: string
      }> | undefined

      if (!results || results.length === 0) {
        return { message: 'No results found for this query.' }
      }

      return results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content ?? '',
      }))
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
        maxContentLength: 5 * 1024 * 1024,
      })

      const $ = cheerio.load(response.data)

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

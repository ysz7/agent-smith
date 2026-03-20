import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ExtensionAPI } from '@agent-smith/core'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'browser_search',
    description: 'Search the web and return top results with titles, URLs, and snippets. Uses Brave Search API if configured, otherwise returns an error with setup instructions.',
    parameters: {
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum number of results to return (default: 5, max: 10)' },
      },
      required: ['query'],
    },
    run: async ({ query, maxResults = 5 }: { query: string; maxResults?: number }) => {
      const extConfig = (api.config.extensions['browser']?.config ?? {}) as Record<string, string>
      const braveApiKey = extConfig.braveApiKey

      if (!braveApiKey) {
        return {
          error: 'Web search is not configured. To enable search, go to Settings → Extensions → browser → Configure and enter a Brave Search API key. Get a free key (2000 searches/month) at https://api.search.brave.com/register',
        }
      }

      const limit = Math.min(maxResults, 10)

      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': braveApiKey,
        },
        params: { q: query, count: limit },
        timeout: 10000,
      })

      const webResults = response.data?.web?.results as Array<{
        title: string
        url: string
        description?: string
      }> | undefined

      if (!webResults || webResults.length === 0) {
        return { message: 'No results found for this query.' }
      }

      return webResults.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description ?? '',
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

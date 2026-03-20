"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = register;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
function register(api) {
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
        run: async ({ query, maxResults = 5 }) => {
            const limit = Math.min(maxResults, 10);
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await axios_1.default.get(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 10000,
            });
            const $ = cheerio.load(response.data);
            const results = [];
            $('.result').each((_i, el) => {
                if (results.length >= limit)
                    return false;
                const titleEl = $(el).find('.result__title a');
                const snippetEl = $(el).find('.result__snippet');
                const title = titleEl.text().trim();
                const href = titleEl.attr('href') ?? '';
                const snippet = snippetEl.text().trim();
                // DuckDuckGo wraps links in a redirect — extract the actual URL
                let resultUrl = href;
                try {
                    const parsed = new URL(href, 'https://duckduckgo.com');
                    resultUrl = parsed.searchParams.get('uddg') ?? href;
                }
                catch {
                    // Use href as-is
                }
                if (title) {
                    results.push({ title, url: resultUrl, snippet });
                }
            });
            if (results.length === 0) {
                return { message: 'No results found. Try a different query.' };
            }
            return results;
        },
    });
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
        run: async ({ url, maxLength = 8000 }) => {
            const response = await axios_1.default.get(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 15000,
                maxContentLength: 5 * 1024 * 1024, // 5 MB limit
            });
            const $ = cheerio.load(response.data);
            // Remove noise elements
            $('script, style, nav, footer, header, iframe, noscript, [hidden]').remove();
            const text = $('body')
                .text()
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, maxLength);
            return { url, content: text, truncated: text.length >= maxLength };
        },
    });
}
//# sourceMappingURL=index.js.map
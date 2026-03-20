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
        description: 'Search the web via Tavily and return top results with titles, URLs, and content snippets',
        parameters: {
            properties: {
                query: { type: 'string', description: 'Search query' },
                maxResults: { type: 'number', description: 'Maximum number of results (default: 5, max: 10)' },
            },
            required: ['query'],
        },
        run: async ({ query, maxResults = 5 }) => {
            const extConfig = (api.config.extensions['browser']?.config ?? {});
            const apiKey = extConfig.tavilyApiKey;
            if (!apiKey) {
                return { error: 'Web search requires a Tavily API key. Add it in Settings → Extensions → browser → Configure. Free key at app.tavily.com (1000 searches/month).' };
            }
            const response = await axios_1.default.post('https://api.tavily.com/search', {
                api_key: apiKey,
                query,
                max_results: Math.min(maxResults, 10),
                search_depth: 'basic',
                include_answer: false,
            }, { timeout: 15000 });
            const results = response.data?.results;
            if (!results || results.length === 0) {
                return { message: 'No results found for this query.' };
            }
            return results.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.content ?? '',
            }));
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
                maxContentLength: 5 * 1024 * 1024,
            });
            const $ = cheerio.load(response.data);
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
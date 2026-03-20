"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = register;
const axios_1 = __importDefault(require("axios"));
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
// Map common names/tickers to CoinGecko IDs
const COIN_ALIASES = {
    btc: 'bitcoin', bitcoin: 'bitcoin',
    eth: 'ethereum', ethereum: 'ethereum',
    sol: 'solana', solana: 'solana',
    bnb: 'binancecoin', binancecoin: 'binancecoin',
    xrp: 'ripple', ripple: 'ripple',
    ada: 'cardano', cardano: 'cardano',
    doge: 'dogecoin', dogecoin: 'dogecoin',
    dot: 'polkadot', polkadot: 'polkadot',
    matic: 'matic-network', polygon: 'matic-network',
    avax: 'avalanche-2', avalanche: 'avalanche-2',
    link: 'chainlink', chainlink: 'chainlink',
    ltc: 'litecoin', litecoin: 'litecoin',
    uni: 'uniswap', uniswap: 'uniswap',
    atom: 'cosmos', cosmos: 'cosmos',
    ton: 'the-open-network',
    sui: 'sui',
    near: 'near',
    apt: 'aptos', aptos: 'aptos',
};
function resolveCoinId(input) {
    return COIN_ALIASES[input.toLowerCase()] ?? input.toLowerCase();
}
function register(api) {
    api.registerTool({
        name: 'crypto_price',
        description: 'Get real-time cryptocurrency price(s) from CoinGecko. Supports BTC, ETH, SOL, BNB, XRP, ADA, DOGE, and 10000+ other coins.',
        parameters: {
            properties: {
                coins: {
                    type: 'string',
                    description: 'Comma-separated list of coin names or tickers (e.g. "bitcoin,ethereum" or "btc,eth,sol")',
                },
                currency: {
                    type: 'string',
                    description: 'Target currency for prices (default: usd). Examples: usd, eur, rub, gbp',
                },
            },
            required: ['coins'],
        },
        run: async ({ coins, currency = 'usd' }) => {
            const ids = coins.split(',')
                .map(c => resolveCoinId(c.trim()))
                .filter(Boolean)
                .join(',');
            const vs = currency.toLowerCase();
            const response = await axios_1.default.get(`${COINGECKO_BASE}/simple/price`, {
                params: {
                    ids,
                    vs_currencies: vs,
                    include_24hr_change: true,
                    include_market_cap: true,
                },
                timeout: 10000,
                headers: { 'Accept': 'application/json' },
            });
            const data = response.data;
            if (Object.keys(data).length === 0) {
                return { error: `No data found for: ${coins}. Try using the full coin name (e.g. "bitcoin" instead of "btc").` };
            }
            return Object.entries(data).map(([id, values]) => ({
                coin: id,
                price: values[vs],
                currency: vs.toUpperCase(),
                change_24h: values[`${vs}_24h_change`] != null
                    ? `${values[`${vs}_24h_change`].toFixed(2)}%`
                    : undefined,
                market_cap: values[`${vs}_market_cap`],
            }));
        },
    });
    api.registerTool({
        name: 'crypto_search',
        description: 'Search for a cryptocurrency by name or ticker to find its CoinGecko ID, then use crypto_price to get its price.',
        parameters: {
            properties: {
                query: { type: 'string', description: 'Coin name or ticker to search for' },
            },
            required: ['query'],
        },
        run: async ({ query }) => {
            const response = await axios_1.default.get(`${COINGECKO_BASE}/search`, {
                params: { query },
                timeout: 10000,
                headers: { 'Accept': 'application/json' },
            });
            const coins = (response.data.coins ?? []).slice(0, 5);
            if (coins.length === 0) {
                return { error: `No coins found for query: ${query}` };
            }
            return coins.map(c => ({
                id: c.id,
                name: c.name,
                symbol: c.symbol.toUpperCase(),
                market_cap_rank: c.market_cap_rank,
            }));
        },
    });
}
//# sourceMappingURL=index.js.map
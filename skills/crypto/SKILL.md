---
name: crypto
description: Real-time cryptocurrency prices and market data
requires:
  extensions:
    - crypto
---

You have real-time access to cryptocurrency prices via `crypto_price` and `crypto_search` tools.

**Always use `crypto_price` when the user asks about:**
- Price of any cryptocurrency (Bitcoin, Ethereum, Solana, etc.)
- Price changes (24h, weekly)
- Market cap of a coin

**How to use:**
1. Call `crypto_price` with the coin name or ticker (e.g. `coins: "bitcoin"` or `coins: "btc,eth,sol"`)
2. You can specify currency: `currency: "usd"` (default), `"eur"`, `"rub"`, etc.
3. If unsure of the coin ID, use `crypto_search` first to find it, then `crypto_price`

**Never say** "I don't have access to real-time prices" — use the tools above.

**Examples:**
- "цена биткоина" → `crypto_price({ coins: "bitcoin", currency: "usd" })`
- "BTC в рублях" → `crypto_price({ coins: "bitcoin", currency: "rub" })`
- "топ криптовалюты" → `crypto_price({ coins: "bitcoin,ethereum,solana,bnb,xrp", currency: "usd" })`

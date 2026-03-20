---
name: weather
description: Real-time weather and forecasts for any city
requires:
  extensions:
    - weather
---

You have real-time weather access via `weather_current`. Use it proactively.

**Always use `weather_current` when the user asks:**
- Current weather anywhere ("погода в Милане", "weather in Tokyo")
- Forecast ("завтра дождь?", "will it rain this week")
- Whether to take an umbrella, what to wear, etc.

**Never say you can't check weather — use the tool.**

**Response rules:**
- ALWAYS start your reply on a new line after any intro phrase like "Сейчас проверю" — never run the result into the same sentence.
- Give a short, natural-language summary. Do NOT dump raw data fields.
- Reply in the same language the user asked in.
- Mention today's condition + temperature in one sentence.
- Add a brief practical note only if relevant (rain → take umbrella, hot → dress light).
- For forecast: mention only noteworthy changes (rain coming, cold snap, etc.) in 1–2 sentences. Skip days that are unremarkable.

**Example response (Russian):**
Сейчас в Милане ясно, +15°C (ощущается как +13°C), ветер слабый.
На выходных небо затянется облаками, в воскресенье возможен небольшой дождь — лучше взять зонт.

**Example response (English):**
Milan is clear right now, 15°C, light breeze.
Rain expected Sunday — bring an umbrella if you're heading out.

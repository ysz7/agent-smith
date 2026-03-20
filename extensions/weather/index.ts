import axios from 'axios'
import type { ExtensionAPI } from '@agent-smith/core'

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
}

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'weather_current',
    description: 'Get current weather and today\'s forecast for any city. Free, no API key needed.',
    parameters: {
      properties: {
        city: { type: 'string', description: 'City name (e.g. "Milan", "Moscow", "New York")' },
        days: { type: 'number', description: 'Number of forecast days (1-7, default: 3)' },
      },
      required: ['city'],
    },
    run: async ({ city, days = 3 }: { city: string; days?: number }) => {
      // 1. Geocode city
      const geoRes = await axios.get(GEO_URL, {
        params: { name: city, count: 1, language: 'en', format: 'json' },
        timeout: 8000,
      })

      const results = geoRes.data.results as Array<{
        name: string; country: string; latitude: number; longitude: number; timezone: string
      }> | undefined

      if (!results || results.length === 0) {
        return { error: `City not found: ${city}` }
      }

      const { name, country, latitude, longitude, timezone } = results[0]

      // 2. Fetch weather
      const forecastDays = Math.max(1, Math.min(7, days))
      const weatherRes = await axios.get(WEATHER_URL, {
        params: {
          latitude,
          longitude,
          current: 'temperature_2m,apparent_temperature,weathercode,windspeed_10m,relative_humidity_2m',
          daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max',
          timezone,
          forecast_days: forecastDays,
        },
        timeout: 8000,
      })

      const { current, daily } = weatherRes.data

      return {
        location: `${name}, ${country}`,
        current: {
          condition: WMO_CODES[current.weathercode] ?? `Code ${current.weathercode}`,
          temperature: `${current.temperature_2m}°C`,
          feels_like: `${current.apparent_temperature}°C`,
          humidity: `${current.relative_humidity_2m}%`,
          wind: `${current.windspeed_10m} km/h`,
        },
        forecast: (daily.time as string[]).map((date: string, i: number) => ({
          date,
          condition: WMO_CODES[daily.weathercode[i]] ?? `Code ${daily.weathercode[i]}`,
          high: `${daily.temperature_2m_max[i]}°C`,
          low: `${daily.temperature_2m_min[i]}°C`,
          precipitation: `${daily.precipitation_sum[i]} mm`,
          wind_max: `${daily.windspeed_10m_max[i]} km/h`,
        })),
      }
    },
  })
}

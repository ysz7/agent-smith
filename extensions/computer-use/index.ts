import type { ExtensionAPI } from '@agent-smith/core'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'

// Singleton browser session — persists across tool calls within a session
let context: any = null
let page: any = null

async function ensureBrowser(userDataDir: string, headless: boolean): Promise<void> {
  if (context && page) return
  await fs.mkdir(userDataDir, { recursive: true })
  const { chromium } = await import('playwright')
  context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  })
  page = context.pages()[0] ?? await context.newPage()
}

async function closeBrowser(): Promise<void> {
  try {
    await context?.close()
  } catch { /* ignore */ }
  context = null
  page = null
}

export default function register(api: ExtensionAPI): void {
  const userDataDir = path.join(os.homedir(), '.agent-smith', 'computer-use-profile')
  const screenshotsDir = path.join(os.homedir(), '.agent-smith', 'screenshots')
  const pdfDir = path.join(os.homedir(), '.agent-smith', 'pdfs')
  const headless = (api.config.extensions['computer-use']?.config?.headless as boolean) ?? false

  // ── Navigate ────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_navigate',
    description: 'Open a URL in the browser. Returns page title and final URL after navigation.',
    parameters: {
      properties: {
        url: { type: 'string', description: 'Full URL to navigate to (must include https://)' },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          description: 'When to consider navigation done (default: domcontentloaded)',
        },
      },
      required: ['url'],
    },
    run: async ({ url, waitUntil = 'domcontentloaded' }: { url: string; waitUntil?: string }) => {
      await ensureBrowser(userDataDir, headless)
      await page.goto(url, { waitUntil, timeout: 30000 })
      return { url: page.url(), title: await page.title() }
    },
  })

  // ── Screenshot ───────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_screenshot',
    description: 'Take a screenshot of the current browser page. Saves to ~/.agent-smith/screenshots/ and returns the file path.',
    parameters: {
      properties: {
        fullPage: { type: 'boolean', description: 'Capture the full scrollable page (default: false — visible viewport only)' },
        selector: { type: 'string', description: 'CSS selector to screenshot a specific element (optional)' },
      },
      required: [],
    },
    run: async ({ fullPage = false, selector }: { fullPage?: boolean; selector?: string }) => {
      await ensureBrowser(userDataDir, headless)
      await fs.mkdir(screenshotsDir, { recursive: true })
      const filename = `screenshot-${Date.now()}.png`
      const filePath = path.join(screenshotsDir, filename)

      if (selector) {
        const el = page.locator(selector).first()
        await el.screenshot({ path: filePath })
      } else {
        await page.screenshot({ path: filePath, fullPage })
      }

      return {
        saved: filePath,
        url: page.url(),
        title: await page.title(),
        message: `Screenshot saved. User can open: ${filePath}`,
      }
    },
  })

  // ── Click ────────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_click',
    description: 'Click an element on the page by CSS selector or visible text.',
    parameters: {
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click (e.g. "button#submit", "a.nav-link")' },
        text: { type: 'string', description: 'Click by visible text content instead of selector (e.g. "Sign in", "Submit")' },
        waitAfter: { type: 'number', description: 'Milliseconds to wait after click (default: 500)' },
      },
      required: [],
    },
    run: async ({ selector, text, waitAfter = 500 }: { selector?: string; text?: string; waitAfter?: number }) => {
      await ensureBrowser(userDataDir, headless)
      if (text) {
        await page.getByText(text, { exact: false }).first().click()
      } else if (selector) {
        await page.locator(selector).first().click()
      } else {
        return { error: 'Provide either selector or text' }
      }
      if (waitAfter > 0) await page.waitForTimeout(waitAfter)
      return { clicked: selector ?? text, url: page.url(), title: await page.title() }
    },
  })

  // ── Type ─────────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_type',
    description: 'Type text into a focused input or the currently active element. Use computer_fill to target a specific input by selector.',
    parameters: {
      properties: {
        text: { type: 'string', description: 'Text to type' },
        pressEnter: { type: 'boolean', description: 'Press Enter after typing (default: false)' },
        delay: { type: 'number', description: 'Delay between keystrokes in ms for human-like typing (default: 0)' },
      },
      required: ['text'],
    },
    run: async ({ text, pressEnter = false, delay = 0 }: { text: string; pressEnter?: boolean; delay?: number }) => {
      await ensureBrowser(userDataDir, headless)
      await page.keyboard.type(text, { delay })
      if (pressEnter) await page.keyboard.press('Enter')
      return { typed: text, pressedEnter: pressEnter }
    },
  })

  // ── Fill ─────────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_fill',
    description: 'Clear and fill a specific input field by CSS selector, placeholder text, or label.',
    parameters: {
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input (e.g. "input[name=email]", "#search")' },
        placeholder: { type: 'string', description: 'Find input by its placeholder text' },
        label: { type: 'string', description: 'Find input by its associated label text' },
        value: { type: 'string', description: 'Value to fill in' },
        pressEnter: { type: 'boolean', description: 'Press Enter after filling (default: false)' },
      },
      required: ['value'],
    },
    run: async ({ selector, placeholder, label, value, pressEnter = false }: {
      selector?: string; placeholder?: string; label?: string; value: string; pressEnter?: boolean
    }) => {
      await ensureBrowser(userDataDir, headless)
      let locator: any
      if (selector) {
        locator = page.locator(selector).first()
      } else if (placeholder) {
        locator = page.getByPlaceholder(placeholder, { exact: false }).first()
      } else if (label) {
        locator = page.getByLabel(label, { exact: false }).first()
      } else {
        return { error: 'Provide selector, placeholder, or label' }
      }
      await locator.fill(value)
      if (pressEnter) await page.keyboard.press('Enter')
      return { filled: value, pressedEnter: pressEnter }
    },
  })

  // ── Get text ─────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_get_text',
    description: 'Get the visible text content of the current page or a specific element.',
    parameters: {
      properties: {
        selector: { type: 'string', description: 'CSS selector to extract text from a specific element (optional — omit to get full page text)' },
        maxLength: { type: 'number', description: 'Max characters to return (default: 6000)' },
      },
      required: [],
    },
    run: async ({ selector, maxLength = 6000 }: { selector?: string; maxLength?: number }) => {
      await ensureBrowser(userDataDir, headless)
      let text: string
      if (selector) {
        text = await page.locator(selector).first().innerText()
      } else {
        text = await page.evaluate(() => document.body.innerText)
      }
      const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, maxLength)
      return { url: page.url(), title: await page.title(), text: trimmed, truncated: text.length > maxLength }
    },
  })

  // ── Wait ─────────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_wait',
    description: 'Wait for an element to appear, or just wait a fixed amount of time.',
    parameters: {
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for (optional)' },
        ms: { type: 'number', description: 'Fixed wait time in milliseconds (default: 1000)' },
      },
      required: [],
    },
    run: async ({ selector, ms = 1000 }: { selector?: string; ms?: number }) => {
      await ensureBrowser(userDataDir, headless)
      if (selector) {
        await page.waitForSelector(selector, { timeout: 15000 })
        return { waited: `element "${selector}" appeared` }
      }
      await page.waitForTimeout(ms)
      return { waited: `${ms}ms` }
    },
  })

  // ── PDF ──────────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_pdf',
    description: 'Save the current page as a PDF file. Returns the file path.',
    parameters: {
      properties: {
        filename: { type: 'string', description: 'Output filename without extension (default: page title or timestamp)' },
      },
      required: [],
    },
    run: async ({ filename }: { filename?: string }) => {
      await ensureBrowser(userDataDir, headless)
      await fs.mkdir(pdfDir, { recursive: true })
      const title = await page.title()
      const name = filename ?? (title.replace(/[^a-z0-9]/gi, '-').slice(0, 60) || `page-${Date.now()}`)
      const filePath = path.join(pdfDir, `${name}.pdf`)
      await page.pdf({ path: filePath, format: 'A4', printBackground: true })
      return { saved: filePath, url: page.url(), title }
    },
  })

  // ── Close ────────────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'computer_close',
    description: 'Close the browser and end the current automation session.',
    parameters: { properties: {}, required: [] },
    run: async () => {
      await closeBrowser()
      return { closed: true }
    },
  })
}

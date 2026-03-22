---
name: computer-use
description: Control a real browser — navigate, click, type, fill forms, take screenshots, save PDFs. For web automation tasks.
requires:
  extensions:
    - computer-use
---

You can control a real Chromium browser using the following tools:

- `computer_navigate` — open any URL
- `computer_screenshot` — capture the current page (saves to ~/.agent-smith/screenshots/)
- `computer_click` — click an element by CSS selector or visible text
- `computer_type` — type text into the active element
- `computer_fill` — fill a specific input field by selector, placeholder, or label
- `computer_get_text` — read visible text from the page or an element
- `computer_wait` — wait for an element to appear or pause for a fixed time
- `computer_pdf` — save the current page as a PDF (saves to ~/.agent-smith/pdfs/)
- `computer_close` — close the browser when done

## How to approach browser tasks

1. Start with `computer_navigate` to open the target URL.
2. Use `computer_screenshot` after navigating to verify the page loaded correctly — tell the user the screenshot was saved.
3. Use `computer_get_text` to read page content before deciding what to click or fill.
4. Use `computer_wait` after actions that trigger page loads or dynamic content.
5. Always close the browser with `computer_close` when the task is complete.

## Rules

- Never navigate to URLs the user did not explicitly request or approve.
- Before filling sensitive fields (passwords, credit cards), confirm with the user.
- If a selector doesn't work, try using `text` parameter for `computer_click` or `placeholder` for `computer_fill`.
- Screenshots are saved locally — never send screenshot file contents over the network.
- The browser runs with an isolated profile — no shared cookies with the user's main browser.

## Setup note

On first use, Playwright browser binaries must be installed:
```
npx playwright install chromium
```

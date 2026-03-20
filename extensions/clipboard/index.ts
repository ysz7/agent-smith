import type { ExtensionAPI } from '@agent-smith/core'

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'clipboard_read',
    description: 'Read the current text content from the system clipboard',
    parameters: {
      properties: {},
      required: [],
    },
    run: async () => {
      const { default: clipboardy } = await import('clipboardy')
      const text = await clipboardy.read()
      return { content: text, length: text.length }
    },
  })

  api.registerTool({
    name: 'clipboard_write',
    description: 'Write text to the system clipboard',
    parameters: {
      properties: {
        text: { type: 'string', description: 'Text to copy to clipboard' },
      },
      required: ['text'],
    },
    run: async ({ text }: { text: string }) => {
      const { default: clipboardy } = await import('clipboardy')
      await clipboardy.write(text)
      return { ok: true, length: text.length }
    },
  })
}

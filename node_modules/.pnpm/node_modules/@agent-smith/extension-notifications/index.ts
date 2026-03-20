import notifier from 'node-notifier'
import type { ExtensionAPI } from '@agent-smith/core'

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'notification_send',
    description: 'Send a system desktop notification to the user',
    parameters: {
      properties: {
        title: { type: 'string', description: 'Notification title' },
        message: { type: 'string', description: 'Notification body message' },
        sound: { type: 'boolean', description: 'Play a sound with the notification (default: true)' },
      },
      required: ['title', 'message'],
    },
    run: async ({ title, message, sound = true }: {
      title: string
      message: string
      sound?: boolean
    }) => {
      return new Promise((resolve, reject) => {
        notifier.notify(
          {
            title,
            message,
            // node-notifier accepts sound as string (sound name) on macOS, boolean-like on others
            sound: sound ? true : false,
            appName: api.config.agent.name ?? 'Agent Smith',
          } as any,
          (err: Error | null) => {
            if (err) {
              reject(new Error(`Notification failed: ${err.message}`))
            } else {
              resolve({ sent: true, title, message })
            }
          },
        )
      })
    },
  })
}

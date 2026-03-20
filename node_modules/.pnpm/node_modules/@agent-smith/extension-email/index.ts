import nodemailer from 'nodemailer'
import type { ExtensionAPI } from '@agent-smith/core'

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'email_send',
    description: 'Send an email via SMTP. Requires email SMTP configuration in extension settings.',
    parameters: {
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (plain text)' },
        html: { type: 'string', description: 'Email body as HTML (optional, overrides plain text body if provided)' },
      },
      required: ['to', 'subject', 'body'],
    },
    run: async ({ to, subject, body, html }: {
      to: string
      subject: string
      body: string
      html?: string
    }) => {
      const emailConfig = (api.config.extensions['email']?.config ?? {}) as Record<string, string>
      const { host, port, user, password, from } = emailConfig

      if (!host || !user || !password) {
        throw new Error(
          'Email extension not configured. Set host, port, user, password, and from in extension settings.',
        )
      }

      const transporter = nodemailer.createTransport({
        host,
        port: Number(port ?? 587),
        secure: Number(port) === 465,
        auth: { user, pass: password },
      })

      const info = await transporter.sendMail({
        from: from ?? user,
        to,
        subject,
        text: body,
        ...(html ? { html } : {}),
      })

      return { messageId: info.messageId, accepted: info.accepted }
    },
  })
}

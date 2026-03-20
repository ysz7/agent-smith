import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { randomUUID } from 'crypto'
import type { ITransport, IConfigManager, IncomingMessage, OutgoingMessage } from '@agent-smith/core'

export class LocalGateway implements ITransport {
  private app = express()
  private server = createServer(this.app)
  private wss = new WebSocketServer({ server: this.server })
  private connections = new Map<string, WebSocket>()
  private messageHandler?: (msg: IncomingMessage) => void
  private userSkillsDir?: string
  private skillsProvider?: () => { name: string; description: string; enabled: boolean; requires?: { extensions: string[] }; config?: Record<string, any> }[]
  private extensionsProvider?: () => { name: string; enabled: boolean }[]
  private historyProvider?: () => Promise<{ id: string; role: string; content: string; timestamp: string }[]>
  private stylesProvider?: () => Promise<{ name: string; description: string }[]>
  private setStyleHandler?: (name: string) => Promise<void>

  constructor(
    private port: number,
    private configManager: IConfigManager,
    private uiDir?: string,
    userSkillsDir?: string,
  ) {
    this.userSkillsDir = userSkillsDir
    this.setupMiddleware()
    this.setupRoutes()
    this.setupWebSocket()
  }

  onMessage(handler: (msg: IncomingMessage) => void): void {
    this.messageHandler = handler
  }

  async send(connectionId: string, message: OutgoingMessage): Promise<void> {
    const ws = this.connections.get(connectionId)
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  async broadcast(message: OutgoingMessage): Promise<void> {
    const payload = JSON.stringify(message)
    for (const [, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload)
      }
    }
  }

  setSkillsProvider(fn: () => { name: string; description: string; enabled: boolean; requires?: { extensions: string[] }; config?: Record<string, any> }[]): void {
    this.skillsProvider = fn
  }

  setExtensionsProvider(fn: () => { name: string; enabled: boolean }[]): void {
    this.extensionsProvider = fn
  }

  setHistoryProvider(fn: () => Promise<{ id: string; role: string; content: string; timestamp: string }[]>): void {
    this.historyProvider = fn
  }

  setStylesProvider(fn: () => Promise<{ name: string; description: string }[]>): void {
    this.stylesProvider = fn
  }

  setSetStyleHandler(fn: (name: string) => Promise<void>): void {
    this.setStyleHandler = fn
  }

  start(hostname = '127.0.0.1'): void {
    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${this.port} is already in use.`)
        console.error(`   Run this to free it: npx kill-port ${this.port}`)
        console.error(`   Or change the port in ~/.agent-smith/config.json\n`)
        process.exit(1)
      } else {
        throw err
      }
    })
    this.server.listen(this.port, hostname, () => {
      console.log(`Agent Smith listening at http://${hostname}:${this.port}`)
    })
  }

  private setupMiddleware(): void {
    this.app.use(express.json())

    if (this.uiDir && fs.existsSync(this.uiDir)) {
      this.app.use(express.static(this.uiDir))
    }
  }

  private setupRoutes(): void {
    // GET /api/config — returns config with apiKey masked
    this.app.get('/api/config', async (_req, res) => {
      try {
        const config = await this.configManager.load()
        res.json({ ...config, apiKey: config.apiKey ? '***' : '' })
      } catch {
        res.status(500).json({ error: 'Failed to load config' })
      }
    })

    // POST /api/config — update config fields
    this.app.post('/api/config', async (req, res) => {
      try {
        await this.configManager.save(req.body)
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to save config' })
      }
    })

    // POST /api/config/apikey — save API key securely
    this.app.post('/api/config/apikey', async (req, res) => {
      try {
        const { apiKey } = req.body
        if (typeof apiKey !== 'string' || !apiKey.trim()) {
          res.status(400).json({ error: 'apiKey is required' })
          return
        }
        await this.configManager.setApiKey(apiKey.trim())
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to save API key' })
      }
    })

    // POST /api/skills/:name/toggle
    this.app.post('/api/skills/:name/toggle', async (req, res) => {
      try {
        const { enabled } = req.body
        await this.configManager.toggleSkill(req.params.name, Boolean(enabled))
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to toggle skill' })
      }
    })

    // POST /api/extensions/:name/toggle
    this.app.post('/api/extensions/:name/toggle', async (req, res) => {
      try {
        const { enabled } = req.body
        await this.configManager.toggleExtension(req.params.name, Boolean(enabled))
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to toggle extension' })
      }
    })

    // POST /api/extensions/:name/config — save extension-specific config fields
    this.app.post('/api/extensions/:name/config', async (req, res) => {
      try {
        await this.configManager.updateExtensionConfig(req.params.name, req.body)
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to save extension config' })
      }
    })

    // GET /api/skills — returns full list of discovered skills with enabled status
    this.app.get('/api/skills', async (_req, res) => {
      try {
        if (this.skillsProvider) {
          const skills = this.skillsProvider()
          // Merge with fresh config so toggles are reflected immediately
          const config = await this.configManager.load()
          res.json(skills.map(s => ({
            ...s,
            enabled: config.skills[s.name]?.enabled ?? true,
          })))
        } else {
          const config = await this.configManager.load()
          res.json(Object.entries(config.skills).map(([name, entry]) => ({ name, ...entry })))
        }
      } catch {
        res.status(500).json({ error: 'Failed to load skills' })
      }
    })

    // GET /api/extensions — returns full list of discovered extensions with enabled status and config
    this.app.get('/api/extensions', async (_req, res) => {
      try {
        if (this.extensionsProvider) {
          const exts = this.extensionsProvider()
          const config = await this.configManager.load()
          res.json(exts.map(e => ({
            ...e,
            enabled: config.extensions[e.name]?.enabled ?? true,
            config: config.extensions[e.name]?.config ?? {},
          })))
        } else {
          const config = await this.configManager.load()
          res.json(Object.entries(config.extensions).map(([name, entry]) => ({ name, ...entry })))
        }
      } catch {
        res.status(500).json({ error: 'Failed to load extensions' })
      }
    })

    // GET /api/history — recent chat history for UI on reconnect
    this.app.get('/api/history', async (_req, res) => {
      try {
        if (this.historyProvider) {
          res.json(await this.historyProvider())
        } else {
          res.json([])
        }
      } catch {
        res.status(500).json({ error: 'Failed to load history' })
      }
    })

    // GET /api/styles — list available response styles
    this.app.get('/api/styles', async (_req, res) => {
      try {
        const styles = this.stylesProvider ? await this.stylesProvider() : []
        const config = await this.configManager.load()
        res.json({ styles, active: config.activeStyle ?? 'default' })
      } catch {
        res.status(500).json({ error: 'Failed to load styles' })
      }
    })

    // POST /api/styles/active — set active response style
    this.app.post('/api/styles/active', async (req, res) => {
      try {
        const { name } = req.body
        if (typeof name !== 'string' || !name.trim()) {
          res.status(400).json({ error: 'name is required' })
          return
        }
        await this.configManager.save({ activeStyle: name })
        if (this.setStyleHandler) await this.setStyleHandler(name)
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to set style' })
      }
    })

    // GET /api/tasks — list all scheduled tasks
    this.app.get('/api/tasks', async (_req, res) => {
      try {
        const tasks = await this.configManager.getTasks()
        res.json(tasks)
      } catch {
        res.status(500).json({ error: 'Failed to load tasks' })
      }
    })

    // POST /api/tasks — create a new scheduled task
    this.app.post('/api/tasks', async (req, res) => {
      try {
        const { name, cron, instructions, enabled = true } = req.body
        if (!name || !cron || !instructions) {
          res.status(400).json({ error: 'name, cron, and instructions are required' })
          return
        }
        const id = await this.configManager.createTask({ name, cron, instructions, enabled })
        res.json({ ok: true, id })
      } catch {
        res.status(500).json({ error: 'Failed to create task' })
      }
    })

    // PUT /api/tasks/:id — update an existing task
    this.app.put('/api/tasks/:id', async (req, res) => {
      try {
        await this.configManager.updateTask(req.params.id, req.body)
        res.json({ ok: true })
      } catch (err: any) {
        res.status(500).json({ error: err?.message ?? 'Failed to update task' })
      }
    })

    // DELETE /api/tasks/:id — delete a task
    this.app.delete('/api/tasks/:id', async (req, res) => {
      try {
        await this.configManager.deleteTask(req.params.id)
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to delete task' })
      }
    })

    // POST /api/skills/install — install a skill from a URL or local path
    this.app.post('/api/skills/install', async (req, res) => {
      try {
        const { source } = req.body
        if (!source || typeof source !== 'string') {
          res.status(400).json({ error: 'source is required' })
          return
        }

        const skillsDir = this.userSkillsDir
        if (!skillsDir) {
          res.status(503).json({ error: 'Skill install directory not configured' })
          return
        }

        await fsp.mkdir(skillsDir, { recursive: true })

        if (source.startsWith('http://') || source.startsWith('https://')) {
          let rawUrl = source
          if (rawUrl.includes('github.com') && !rawUrl.includes('raw.githubusercontent.com')) {
            rawUrl = rawUrl
              .replace('github.com', 'raw.githubusercontent.com')
              .replace('/blob/', '/')
              .replace('/tree/', '/')
          }
          if (!rawUrl.endsWith('SKILL.md')) {
            rawUrl = rawUrl.replace(/\/$/, '') + '/SKILL.md'
          }

          const { default: https } = await import('https')
          const { default: http } = await import('http')
          const content = await new Promise<string>((resolve, reject) => {
            const client = rawUrl.startsWith('https') ? https : http
            client.get(rawUrl, (fetchRes: any) => {
              if (fetchRes.statusCode !== 200) {
                reject(new Error(`HTTP ${fetchRes.statusCode}`))
                return
              }
              let data = ''
              fetchRes.on('data', (chunk: Buffer) => { data += chunk.toString() })
              fetchRes.on('end', () => resolve(data))
            }).on('error', reject)
          })

          const nameMatch = content.match(/^name:\s*(.+)$/m)
          const skillName = nameMatch ? nameMatch[1].trim() : `skill-${Date.now()}`
          const skillDir = path.join(skillsDir, skillName)
          await fsp.mkdir(skillDir, { recursive: true })
          await fsp.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8')
          res.json({ ok: true, skillName })
        } else {
          res.status(400).json({ error: 'Local path install not supported via UI. Use CLI: agent-smith skills install <path>' })
        }
      } catch (err: any) {
        res.status(500).json({ error: err?.message ?? 'Failed to install skill' })
      }
    })

    // SPA catch-all — serve index.html for unknown routes
    if (this.uiDir && fs.existsSync(this.uiDir)) {
      this.app.get('*', (_req, res) => {
        res.sendFile(path.join(this.uiDir!, 'index.html'))
      })
    } else {
      this.app.get('/', (_req, res) => {
        res.send(`
          <html><body style="font-family:sans-serif;padding:2rem">
            <h1>Agent Smith</h1>
            <p>Backend is running. UI not built yet.</p>
            <p>Connect via WebSocket at <code>ws://localhost:${this.port}</code></p>
          </body></html>
        `)
      })
    }
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      const connectionId = randomUUID()
      this.connections.set(connectionId, ws)

      ws.send(JSON.stringify({ type: 'connected', data: { connectionId } }))

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          this.messageHandler?.({
            connectionId,
            type: msg.type ?? 'message',
            content: msg.content ?? '',
            agentId: msg.agentId,
          })
        } catch {
          // Invalid JSON — ignore silently
        }
      })

      ws.on('close', () => this.connections.delete(connectionId))
      ws.on('error', () => this.connections.delete(connectionId))
    })
  }
}

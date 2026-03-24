import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { randomUUID } from 'crypto'
import multer from 'multer'
import type { ITransport, IConfigManager, IncomingMessage, OutgoingMessage, UserAgentDefinition } from '@agent-smith/core'
import { AgentRegistry } from '@agent-smith/core'
import type { ILimaMemory } from '@agent-smith/lima'

export class LocalGateway implements ITransport {
  private app = express()
  private server = createServer(this.app)
  private wss = new WebSocketServer({ server: this.server })
  private connections = new Map<string, WebSocket>()
  private abortControllers = new Map<string, AbortController>()
  private messageHandler?: (msg: IncomingMessage) => void
  private userSkillsDir?: string
  private skillsProvider?: () => { name: string; description: string; enabled: boolean; requires?: { extensions: string[] }; config?: Record<string, any> }[]
  private extensionsProvider?: () => { name: string; enabled: boolean }[]
  private historyProvider?: () => Promise<{ id: string; role: string; content: string; timestamp: string }[]>
  private stylesProvider?: () => Promise<{ name: string; description: string }[]>
  private setStyleHandler?: (name: string) => Promise<void>
  private lima?: ILimaMemory
  private documentsDir?: string
  private agentRegistry?: AgentRegistry

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

  setLima(lima: ILimaMemory): void {
    this.lima = lima
  }

  setDocumentsDir(dir: string): void {
    this.documentsDir = dir
  }

  setAgentRegistry(registry: AgentRegistry): void {
    this.agentRegistry = registry
    registry.on('change', (snapshot) => this.broadcastAgentStatus(snapshot))
  }

  private broadcastAgentStatus(snapshot?: Omit<import('@agent-smith/core').AgentRegistryEntry, 'abort'>[]): void {
    const agents = snapshot ?? this.agentRegistry?.snapshot() ?? []
    const payload = JSON.stringify({ type: 'agent_status', agents })
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    })
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
    // GET /api/config — returns config with all API keys masked
    this.app.get('/api/config', async (_req, res) => {
      try {
        const config = await this.configManager.load()
        const maskedApiKeys = Object.fromEntries(
          Object.entries(config.apiKeys ?? {}).map(([k, v]) => [k, v ? '***' : ''])
        )
        res.json({ ...config, apiKey: config.apiKey ? '***' : '', apiKeys: maskedApiKeys })
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

    // POST /api/config/apikey — save Anthropic API key (legacy)
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

    // POST /api/config/apikeys/:provider — save API key for a specific provider
    this.app.post('/api/config/apikeys/:provider', async (req, res) => {
      try {
        const { provider } = req.params
        const { apiKey } = req.body
        if (typeof apiKey !== 'string') {
          res.status(400).json({ error: 'apiKey is required' })
          return
        }
        const value = apiKey.trim()
        // Also sync legacy apiKey for anthropic
        if (provider === 'anthropic' && value) {
          await this.configManager.setApiKey(value)
        } else {
          await this.configManager.save({ apiKeys: { [provider]: value || undefined } } as any)
        }
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to save API key' })
      }
    })

    // DELETE /api/config/apikeys/:provider — remove a single provider's API key
    this.app.delete('/api/config/apikeys/:provider', async (req, res) => {
      try {
        const { provider } = req.params
        if (provider === 'anthropic') {
          await this.configManager.save({ apiKey: '', apiKeys: { anthropic: '' } } as any)
        } else {
          await this.configManager.save({ apiKeys: { [provider]: '' } } as any)
        }
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to delete API key' })
      }
    })

    // POST /api/config/reset-provider — clear all API keys, returns user to onboarding
    this.app.post('/api/config/reset-provider', async (_req, res) => {
      try {
        await this.configManager.save({ apiKey: '', apiKeys: {} } as any)
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Failed to reset provider' })
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

    // GET /api/ollama/models — list running/available models from local Ollama instance
    this.app.get('/api/ollama/models', async (req, res) => {
      try {
        const config = await this.configManager.load()
        const host = config.ollama?.host ?? 'http://localhost:11434'
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        const response = await fetch(`${host}/api/tags`, { signal: controller.signal })
        clearTimeout(timeout)
        if (!response.ok) {
          res.status(502).json({ error: 'Ollama returned an error', models: [] })
          return
        }
        const data = await response.json() as { models?: { name: string }[] }
        const models = (data.models ?? []).map((m: { name: string }) => m.name)
        res.json({ models })
      } catch (err: any) {
        const msg = err?.message ?? ''
        if (msg.includes('ECONNREFUSED') || msg.includes('aborted') || msg.includes('fetch')) {
          res.json({ models: [], offline: true })
        } else {
          res.status(500).json({ error: 'Failed to fetch Ollama models', models: [] })
        }
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

    // GET /api/memory — list facts (query: scope, source, limit)
    this.app.get('/api/memory', async (req, res) => {
      if (!this.lima) { res.json([]); return }
      try {
        const { scope, source, limit } = req.query as Record<string, string>
        const facts = await this.lima.listMemory({
          scope: scope as any ?? undefined,
          source: source as any ?? undefined,
          limit: limit ? parseInt(limit, 10) : 50,
        })
        res.json(facts)
      } catch {
        res.status(500).json({ error: 'Failed to load memory' })
      }
    })

    // GET /api/memory/stats — memory statistics
    this.app.get('/api/memory/stats', async (_req, res) => {
      if (!this.lima) { res.json({ total: 0, byScope: {}, bySource: {}, dbSizeBytes: 0 }); return }
      try {
        const stats = this.lima.stats ? await this.lima.stats() : { total: 0, byScope: {}, bySource: {}, dbSizeBytes: 0 }
        res.json(stats)
      } catch {
        res.status(500).json({ error: 'Failed to load stats' })
      }
    })

    // GET /api/memory/export — export all facts as JSON file
    this.app.get('/api/memory/export', async (_req, res) => {
      if (!this.lima || !this.lima.export) { res.status(503).json({ error: 'Export not available' }); return }
      try {
        const tmpPath = path.join(os.tmpdir(), `lima-export-${Date.now()}.json`)
        await this.lima.export(tmpPath)
        res.download(tmpPath, 'memory-export.json', () => {
          fsp.unlink(tmpPath).catch(() => {})
        })
      } catch {
        res.status(500).json({ error: 'Export failed' })
      }
    })

    // POST /api/memory/import — import facts from JSON
    this.app.post('/api/memory/import', async (req, res) => {
      if (!this.lima || !this.lima.import) { res.status(503).json({ error: 'Import not available' }); return }
      try {
        const tmpPath = path.join(os.tmpdir(), `lima-import-${Date.now()}.json`)
        await fsp.writeFile(tmpPath, JSON.stringify(req.body), 'utf-8')
        const count = await this.lima.import(tmpPath)
        await fsp.unlink(tmpPath).catch(() => {})
        res.json({ ok: true, imported: count })
      } catch {
        res.status(500).json({ error: 'Import failed' })
      }
    })

    // DELETE /api/memory/:id — delete a single fact
    this.app.delete('/api/memory/:id', async (req, res) => {
      if (!this.lima) { res.status(503).json({ error: 'Memory not available' }); return }
      try {
        const deleted = await this.lima.deleteMemory(req.params.id)
        res.json({ ok: true, deleted })
      } catch {
        res.status(500).json({ error: 'Failed to delete fact' })
      }
    })

    // DELETE /api/memory — bulk delete by filter (body: { scope?, source? })
    this.app.delete('/api/memory', async (req, res) => {
      if (!this.lima) { res.status(503).json({ error: 'Memory not available' }); return }
      try {
        const { scope, source } = req.body ?? {}
        const deleted = await this.lima.deleteMemory({ scope, source })
        res.json({ ok: true, deleted })
      } catch {
        res.status(500).json({ error: 'Failed to delete memory' })
      }
    })

    // POST /api/memory/reset — wipe all facts AND conversation history
    this.app.post('/api/memory/reset', async (_req, res) => {
      if (!this.lima) { res.status(503).json({ error: 'Memory not available' }); return }
      try {
        if (this.lima.resetAll) await this.lima.resetAll()
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Reset failed' })
      }
    })

    // POST /api/memory/reset-history — wipe only conversation history
    this.app.post('/api/memory/reset-history', async (_req, res) => {
      if (!this.lima) { res.status(503).json({ error: 'Memory not available' }); return }
      try {
        if (this.lima.resetHistory) await this.lima.resetHistory()
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Reset failed' })
      }
    })

    // POST /api/memory/reset-facts — wipe only LIMA facts
    this.app.post('/api/memory/reset-facts', async (_req, res) => {
      if (!this.lima) { res.status(503).json({ error: 'Memory not available' }); return }
      try {
        if (this.lima.resetFacts) await this.lima.resetFacts()
        res.json({ ok: true })
      } catch {
        res.status(500).json({ error: 'Reset failed' })
      }
    })

    // POST /api/documents/upload — upload and index a document
    this.app.post('/api/documents/upload', (req, res) => {
      if (!this.lima || !this.documentsDir) {
        res.status(503).json({ error: 'Documents not configured' })
        return
      }

      const storage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, this.documentsDir!),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname)
          const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_')
          cb(null, `${base}-${Date.now()}${ext}`)
        },
      })
      const upload = multer({
        storage,
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
        fileFilter: (_req, file, cb) => {
          const allowed = ['.pdf', '.docx', '.txt', '.md']
          const ext = path.extname(file.originalname).toLowerCase()
          cb(null, allowed.includes(ext))
        },
      }).single('file')

      upload(req, res, async (err) => {
        if (err) { res.status(400).json({ error: err.message }); return }
        if (!req.file) { res.status(400).json({ error: 'No file or unsupported format (allowed: PDF, DOCX, TXT, MD)' }); return }

        try {
          const chunks = await this.lima!.ingestFile(req.file.path)
          res.json({
            ok: true,
            name: req.file.originalname,
            savedAs: req.file.filename,
            path: req.file.path,
            chunks,
          })
        } catch (ingestErr: any) {
          await fsp.unlink(req.file.path).catch(() => {})
          res.status(500).json({ error: ingestErr?.message ?? 'Ingestion failed' })
        }
      })
    })

    // GET /api/documents — list indexed documents
    this.app.get('/api/documents', async (_req, res) => {
      if (!this.lima) { res.json([]); return }
      try {
        const docs = this.lima.listDocuments ? await this.lima.listDocuments() : []
        res.json(docs)
      } catch {
        res.status(500).json({ error: 'Failed to list documents' })
      }
    })

    // DELETE /api/documents — delete document facts + file (body: { source_url })
    this.app.delete('/api/documents', async (req, res) => {
      if (!this.lima) { res.status(503).json({ error: 'Memory not available' }); return }
      try {
        const { source_url } = req.body ?? {}
        if (!source_url) { res.status(400).json({ error: 'source_url required' }); return }
        const deleted = this.lima.deleteDocument ? await this.lima.deleteDocument(source_url) : 0
        // Delete physical file if it lives in our documents dir
        if (this.documentsDir && source_url.startsWith(this.documentsDir)) {
          await fsp.unlink(source_url).catch(() => {})
        }
        res.json({ ok: true, deleted })
      } catch {
        res.status(500).json({ error: 'Failed to delete document' })
      }
    })

    // POST /api/documents/reindex — re-ingest a document (body: { source_url })
    this.app.post('/api/documents/reindex', async (req, res) => {
      if (!this.lima) { res.status(503).json({ error: 'Memory not available' }); return }
      try {
        const { source_url } = req.body ?? {}
        if (!source_url) { res.status(400).json({ error: 'source_url required' }); return }
        if (this.lima.deleteDocument) await this.lima.deleteDocument(source_url)
        const chunks = await this.lima.ingestFile(source_url)
        res.json({ ok: true, chunks })
      } catch (err: any) {
        res.status(500).json({ error: err?.message ?? 'Re-index failed' })
      }
    })

    // ─── Agent registry REST endpoints ────────────────────────────────────────

    // GET /api/agents — list all live agents
    this.app.get('/api/agents', (_req, res) => {
      res.json(this.agentRegistry?.snapshot() ?? [])
    })

    // POST /api/agents — create a user agent
    this.app.post('/api/agents', async (req, res) => {
      if (!this.configManager) { res.status(503).json({ error: 'no config manager' }); return }
      const { name, model, systemPrompt } = req.body
      if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return }

      const config = await this.configManager.load()
      const maxAgents = config.multiAgent.userCreated.maxAgents ?? 10
      const existing = Object.values(config.multiAgent.agents ?? {}).filter(a => !('type' in a))
      if (existing.length >= maxAgents) {
        res.status(400).json({ error: `Max user agents limit (${maxAgents}) reached` }); return
      }

      const def: UserAgentDefinition = {
        id: randomUUID(),
        name: name.trim(),
        model: model ?? config.multiAgent.orchestration?.defaultModel ?? 'claude-haiku-4-5-20251001',
        systemPrompt: systemPrompt?.trim() || undefined,
        createdAt: new Date().toISOString(),
      }

      await this.configManager.createUserAgent(def)
      this.agentRegistry?.register({
        id: def.id,
        name: def.name,
        type: 'user',
        status: 'idle',
        model: def.model,
        createdAt: def.createdAt,
        systemPrompt: def.systemPrompt,
      })

      res.json(def)
    })

    // PUT /api/agents/:id — update a user agent's name, model, systemPrompt
    this.app.put('/api/agents/:id', async (req, res) => {
      const { id } = req.params
      const entry = this.agentRegistry?.get(id)
      if (!entry) { res.status(404).json({ error: 'not found' }); return }
      if (entry.type !== 'user') { res.status(403).json({ error: 'only user agents can be edited' }); return }

      const { name, model, systemPrompt } = req.body
      const patch: any = {}
      if (name?.trim()) patch.name = name.trim()
      if (model) patch.model = model
      if (systemPrompt !== undefined) patch.systemPrompt = systemPrompt.trim() || undefined

      await this.configManager?.updateUserAgent(id, patch)

      // Update live registry entry
      if (patch.name) entry.name = patch.name
      if (patch.model) entry.model = patch.model
      if ('systemPrompt' in patch) entry.systemPrompt = patch.systemPrompt
      this.agentRegistry?.['emit']('change', this.agentRegistry.snapshot())

      res.json({ ok: true })
    })

    // DELETE /api/agents/:id — delete a user agent (not main, not orchestrator)
    this.app.delete('/api/agents/:id', async (req, res) => {
      const { id } = req.params
      const entry = this.agentRegistry?.get(id)
      if (!entry) { res.status(404).json({ error: 'not found' }); return }
      if (entry.type !== 'user') { res.status(403).json({ error: 'only user agents can be deleted' }); return }

      await this.configManager?.deleteUserAgent(id)
      this.agentRegistry?.unregister(id)
      res.json({ ok: true })
    })

    // POST /api/agents/:id/stop — stop an orchestrator agent
    this.app.post('/api/agents/:id/stop', (req, res) => {
      const { id } = req.params
      const entry = this.agentRegistry?.get(id)
      if (!entry) { res.status(404).json({ error: 'not found' }); return }
      if (entry.type === 'main') { res.status(403).json({ error: 'cannot stop main agent' }); return }
      const stopped = this.agentRegistry?.stop(id)
      res.json({ ok: stopped })
    })

    // GET /api/screenshots/:filename — serve screenshot files
    const screenshotsDir = path.join(os.homedir(), '.agent-smith', 'screenshots')
    this.app.get('/api/screenshots/:filename', (req, res) => {
      const filename = path.basename(req.params.filename) // prevent path traversal
      const filePath = path.join(screenshotsDir, filename)
      if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return }
      res.sendFile(filePath)
    })

    // POST /api/reveal — open file location in system file manager
    this.app.post('/api/reveal', async (req, res) => {
      const { filePath } = req.body
      if (typeof filePath !== 'string') { res.status(400).json({ error: 'filePath required' }); return }

      const agentSmithDir = path.join(os.homedir(), '.agent-smith')
      const normalized = path.normalize(filePath)
      if (!normalized.startsWith(agentSmithDir)) {
        res.status(403).json({ error: 'Access denied' }); return
      }

      const { spawn } = await import('child_process')
      if (process.platform === 'win32') {
        spawn('explorer', ['/select,', normalized], { detached: true, stdio: 'ignore' }).unref()
      } else if (process.platform === 'darwin') {
        spawn('open', ['-R', normalized], { detached: true, stdio: 'ignore' }).unref()
      } else {
        spawn('xdg-open', [path.dirname(normalized)], { detached: true, stdio: 'ignore' }).unref()
      }
      res.json({ ok: true })
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

      // Send current agent list to newly connected client
      if (this.agentRegistry) {
        ws.send(JSON.stringify({ type: 'agent_status', agents: this.agentRegistry.snapshot() }))
      }

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())

          if (msg.type === 'stop') {
            this.abortControllers.get(connectionId)?.abort()
            return
          }

          const controller = new AbortController()
          this.abortControllers.set(connectionId, controller)

          this.messageHandler?.({
            connectionId,
            type: msg.type ?? 'message',
            content: msg.content ?? '',
            agentId: msg.agentId,
            signal: controller.signal,
            image: msg.image,
          })
        } catch {
          // Invalid JSON — ignore silently
        }
      })

      ws.on('close', () => {
        this.connections.delete(connectionId)
        this.abortControllers.delete(connectionId)
      })
      ws.on('error', () => this.connections.delete(connectionId))
    })
  }
}

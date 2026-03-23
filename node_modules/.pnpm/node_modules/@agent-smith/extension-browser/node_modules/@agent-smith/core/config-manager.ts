import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'
import type { AgentConfig, IConfigManager, ScheduledTaskDefinition, UserAgentDefinition } from './interfaces'

const CONFIG_VERSION = 1

const DEFAULT_CONFIG: AgentConfig = {
  version: CONFIG_VERSION,
  agent: {
    name: 'Smith',
    model: 'claude-sonnet-4-6',
  },
  apiKey: '',
  activeStyle: 'default',
  skills: {},
  extensions: {},
  multiAgent: {
    userCreated: {
      enabled: true,
      maxAgents: 10,
      persistAgents: true,
    },
    orchestration: {
      enabled: false,
      maxConcurrent: 3,
      defaultModel: 'claude-haiku-4-5-20251001',
      autoDestroy: true,
    },
  },
  transport: {
    port: 3000,
    ui: true,
    localhostOnly: true,
  },
  privacy: {
    warnBeforeSendingFiles: true,
    localAuditLog: false,
    validateSkillsOnInstall: true,
  },
  performance: {
    historyWindow: 20,
    smartCompress: true,
    promptCaching: true,
    limaEnabled: true,
  },
  system: {
    preventSleep: false,
    autoOpenBrowser: true,
    darkTheme: true,
    language: 'en',
  },
  heartbeat: {
    enabled: false,
    intervalMinutes: 15,
  },
}

export class ConfigManager implements IConfigManager {
  private configDir: string
  private configPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? path.join(os.homedir(), '.agent-smith')
    this.configPath = path.join(this.configDir, 'config.json')
  }

  async load(): Promise<AgentConfig> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8')
      const saved = JSON.parse(raw)
      return this.migrate(this.merge(DEFAULT_CONFIG, saved))
    } catch {
      await this.save(DEFAULT_CONFIG)
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  async save(config: Partial<AgentConfig>): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true })
    const current = await this.loadRaw()
    const merged = this.merge(current, config)
    await fs.writeFile(this.configPath, JSON.stringify(merged, null, 2), 'utf-8')
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.save({ apiKey })
  }

  async toggleSkill(name: string, enabled: boolean): Promise<void> {
    const config = await this.load()
    config.skills[name] = { ...(config.skills[name] ?? {}), enabled }
    await this.save(config)
  }

  async toggleExtension(name: string, enabled: boolean): Promise<void> {
    const config = await this.load()
    config.extensions[name] = { ...(config.extensions[name] ?? {}), enabled }
    await this.save(config)
  }

  async updateExtensionConfig(name: string, extConfig: Record<string, any>): Promise<void> {
    const config = await this.load()
    config.extensions[name] = { ...(config.extensions[name] ?? { enabled: true }), config: extConfig }
    await this.save(config)
  }

  async updateSkillConfig(name: string, skillConfig: Record<string, any>): Promise<void> {
    const config = await this.load()
    config.skills[name] = { ...(config.skills[name] ?? { enabled: true }), config: skillConfig }
    await this.save(config)
  }

  async getTasks(): Promise<ScheduledTaskDefinition[]> {
    const config = await this.load()
    return Object.values(config.tasks ?? {})
  }

  async createTask(task: Omit<ScheduledTaskDefinition, 'id'>): Promise<string> {
    const id = randomUUID()
    const config = await this.load()
    config.tasks = config.tasks ?? {}
    config.tasks[id] = { ...task, id }
    await this.writeConfig(config)
    return id
  }

  async updateTask(id: string, updates: Partial<ScheduledTaskDefinition>): Promise<void> {
    const config = await this.load()
    if (!config.tasks?.[id]) throw new Error(`Task ${id} not found`)
    config.tasks[id] = { ...config.tasks[id], ...updates, id }
    await this.writeConfig(config)
  }

  async deleteTask(id: string): Promise<void> {
    const config = await this.load()
    if (config.tasks) {
      delete config.tasks[id]
      await this.writeConfig(config)
    }
  }

  async recordTaskRun(id: string, status: 'success' | 'error', result: string): Promise<void> {
    const config = await this.load()
    if (!config.tasks?.[id]) return
    config.tasks[id].lastRun = new Date().toISOString()
    config.tasks[id].lastStatus = status
    config.tasks[id].lastResult = result
    await this.writeConfig(config)
  }

  async createUserAgent(def: UserAgentDefinition): Promise<void> {
    const config = await this.load()
    const agents = config.multiAgent.agents ?? {}
    config.multiAgent.agents = { ...agents, [def.id]: def }
    await this.writeConfig(config)
  }

  async updateUserAgent(id: string, patch: Partial<Pick<UserAgentDefinition, 'name' | 'model' | 'systemPrompt'>>): Promise<void> {
    const config = await this.load()
    if (!config.multiAgent.agents?.[id]) return
    config.multiAgent.agents[id] = { ...config.multiAgent.agents[id], ...patch }
    await this.writeConfig(config)
  }

  async deleteUserAgent(id: string): Promise<void> {
    const config = await this.load()
    const agents = { ...config.multiAgent.agents }
    delete agents[id]
    config.multiAgent.agents = agents
    await this.writeConfig(config)
  }

  // Write config directly (bypasses merge — used for task mutations to avoid deep-merge issues)
  private async writeConfig(config: AgentConfig): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true })
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  private async loadRaw(): Promise<AgentConfig> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  private merge(base: any, override: any): any {
    const result = { ...base }
    for (const key of Object.keys(override ?? {})) {
      if (
        override[key] !== null &&
        typeof override[key] === 'object' &&
        !Array.isArray(override[key]) &&
        typeof base[key] === 'object' &&
        base[key] !== null
      ) {
        result[key] = this.merge(base[key], override[key])
      } else if (override[key] !== undefined) {
        result[key] = override[key]
      }
    }
    return result
  }

  private migrate(config: AgentConfig): AgentConfig {
    // Future migrations: if (config.version < 2) { ... }
    config.version = CONFIG_VERSION
    return config
  }
}

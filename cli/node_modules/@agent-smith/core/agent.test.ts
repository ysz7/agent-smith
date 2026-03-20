import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IStorage, ITransport, IScheduler, AgentConfig, IncomingMessage, OutgoingMessage } from './interfaces'

// ─── Minimal mocks ─────────────────────────────────────────────────────────────

function makeStorage(): IStorage {
  const store = new Map<string, any>()
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => { store.set(key, value) },
    delete: async (key) => { store.delete(key) },
    list: async (prefix) => [...store.keys()].filter(k => !prefix || k.startsWith(prefix)),
  }
}

function makeTransport() {
  const sent: OutgoingMessage[] = []
  let handler: ((msg: IncomingMessage) => void) | undefined

  const transport: ITransport = {
    onMessage: (h) => { handler = h },
    send: async (_id, msg) => { sent.push(msg) },
    broadcast: async (msg) => { sent.push(msg) },
  }

  return { transport, sent, trigger: (msg: IncomingMessage) => handler?.(msg) }
}

function makeScheduler(): IScheduler {
  const jobs = new Map<string, { cron: string; fn: () => void }>()
  return {
    schedule: (id, cron, fn) => { jobs.set(id, { cron, fn }) },
    cancel: (id) => { jobs.delete(id) },
    list: () => [...jobs.entries()].map(([id, { cron }]) => ({ id, cron, enabled: true })),
  }
}

const BASE_CONFIG: AgentConfig = {
  agent: { name: 'TestSmith', model: 'claude-sonnet-4-6' },
  apiKey: 'sk-ant-test',
  skills: {},
  extensions: {},
  multiAgent: {
    enabled: false,
    dynamic: { enabled: false, maxAgents: 10, autoDestroy: true },
    userCreated: { enabled: false, maxAgents: 10, persistAgents: true },
  },
  transport: { port: 3000, ui: true },
  performance: { historyWindow: 20, smartCompress: false, promptCaching: false },
}

// ─── ConfigManager mock ────────────────────────────────────────────────────────

import { ConfigManager } from './config-manager'
import * as os from 'os'
import * as path from 'path'

// ─── Memory tests ──────────────────────────────────────────────────────────────

import { Memory } from './memory'

describe('Memory', () => {
  it('stores and retrieves messages', async () => {
    const memory = new Memory(makeStorage())
    await memory.add({ role: 'user', content: 'Hello' })
    await memory.add({ role: 'assistant', content: 'Hi there!' })

    const msgs = await memory.getRecent(10)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].content).toBe('Hello')
    expect(msgs[1].role).toBe('assistant')
  })

  it('respects the window size in getRecent', async () => {
    const memory = new Memory(makeStorage())
    for (let i = 0; i < 10; i++) {
      await memory.add({ role: 'user', content: `Message ${i}` })
    }

    const recent = await memory.getRecent(3)
    expect(recent).toHaveLength(3)
    expect(recent[2].content).toBe('Message 9')
  })

  it('reports needsCompression correctly', async () => {
    const memory = new Memory(makeStorage())
    expect(await memory.needsCompression(5)).toBe(false)

    for (let i = 0; i < 6; i++) {
      await memory.add({ role: 'user', content: `msg ${i}` })
    }

    expect(await memory.needsCompression(5)).toBe(true)
  })

  it('compresses with summary', async () => {
    const memory = new Memory(makeStorage())
    for (let i = 0; i < 5; i++) {
      await memory.add({ role: 'user', content: `old message ${i}` })
    }
    await memory.add({ role: 'user', content: 'recent message' })

    await memory.compressWithSummary('User asked about old things.', 1)

    const all = await memory.getAll()
    // Should have: 1 system summary + 1 recent message
    expect(all).toHaveLength(2)
    expect(all[0].role).toBe('system')
    expect(all[0].content).toContain('User asked about old things.')
    expect(all[1].content).toBe('recent message')
  })

  it('clears all messages', async () => {
    const memory = new Memory(makeStorage())
    await memory.add({ role: 'user', content: 'test' })
    await memory.clear()
    expect(await memory.count()).toBe(0)
  })
})

// ─── ConfigManager tests ───────────────────────────────────────────────────────

describe('ConfigManager', () => {
  const tmpDir = path.join(os.tmpdir(), `agent-smith-test-${Date.now()}`)

  it('returns defaults when no config file exists', async () => {
    const mgr = new ConfigManager(tmpDir)
    const config = await mgr.load()
    expect(config.agent.name).toBe('Smith')
    expect(config.transport.port).toBe(3000)
    expect(config.apiKey).toBe('')
  })

  it('persists and reloads config', async () => {
    const mgr = new ConfigManager(tmpDir + '-persist')
    await mgr.setApiKey('sk-ant-test123')
    const config = await mgr.load()
    expect(config.apiKey).toBe('sk-ant-test123')
  })

  it('toggles skill enabled state', async () => {
    const mgr = new ConfigManager(tmpDir + '-skill')
    await mgr.toggleSkill('memory', false)
    const config = await mgr.load()
    expect(config.skills['memory'].enabled).toBe(false)
  })

  it('creates and deletes tasks', async () => {
    const mgr = new ConfigManager(tmpDir + '-tasks')
    const id = await mgr.createTask({
      name: 'Test task',
      cron: '0 9 * * *',
      instructions: 'Do something',
      enabled: true,
    })
    expect(typeof id).toBe('string')

    const tasks = await mgr.getTasks()
    expect(tasks.find(t => t.id === id)).toBeDefined()

    await mgr.deleteTask(id)
    const afterDelete = await mgr.getTasks()
    expect(afterDelete.find(t => t.id === id)).toBeUndefined()
  })

  it('records task run results', async () => {
    const mgr = new ConfigManager(tmpDir + '-taskrun')
    const id = await mgr.createTask({
      name: 'Run test',
      cron: '* * * * *',
      instructions: 'Check something',
      enabled: true,
    })

    await mgr.recordTaskRun(id, 'success', 'All good')
    const tasks = await mgr.getTasks()
    const task = tasks.find(t => t.id === id)!
    expect(task.lastStatus).toBe('success')
    expect(task.lastResult).toBe('All good')
    expect(task.lastRun).toBeDefined()
  })
})


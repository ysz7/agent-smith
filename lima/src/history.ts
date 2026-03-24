import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'crypto'

// Mirror of core/interfaces.ts Message and IHistory — no import to avoid circular dep
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  agentId?: string
}

interface IHistory {
  add(msg: Omit<Message, 'id' | 'timestamp'>): Promise<void>
  getRecent(count: number): Promise<Message[]>
  getAll(): Promise<Message[]>
  clear(): Promise<void>
  count(): Promise<number>
  needsCompression(threshold?: number): Promise<boolean>
  compressWithSummary(summary: string, keepRecentCount: number): Promise<void>
}

export class SqliteHistory implements IHistory {
  private static readonly DEFAULT_COMPRESS_THRESHOLD = 30

  constructor(private db: DatabaseSync) {}

  async add(msg: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
    this.db.prepare(
      `INSERT INTO messages (id, role, content, timestamp, agent_id) VALUES ($id, $role, $content, $timestamp, $agent_id)`
    ).run({
      id: randomUUID(),
      role: msg.role,
      content: msg.content,
      timestamp: new Date().toISOString(),
      agent_id: (msg as any).agentId ?? null,
    })
  }

  async getRecent(count: number): Promise<Message[]> {
    const rows = this.db.prepare(
      `SELECT * FROM (SELECT * FROM messages ORDER BY timestamp DESC LIMIT $count) ORDER BY timestamp ASC`
    ).all({ count }) as Record<string, unknown>[]
    return rows.map(parseRow)
  }

  async getRecentMain(count: number): Promise<Message[]> {
    const rows = this.db.prepare(
      `SELECT * FROM (SELECT * FROM messages WHERE agent_id IS NULL ORDER BY timestamp DESC LIMIT $count) ORDER BY timestamp ASC`
    ).all({ count }) as Record<string, unknown>[]
    return rows.map(parseRow)
  }

  async getRecentForAgent(count: number, agentId: string): Promise<Message[]> {
    const rows = this.db.prepare(
      `SELECT * FROM (SELECT * FROM messages WHERE agent_id = $agentId ORDER BY timestamp DESC LIMIT $count) ORDER BY timestamp ASC`
    ).all({ count, agentId }) as Record<string, unknown>[]
    return rows.map(parseRow)
  }

  async getAll(): Promise<Message[]> {
    const rows = this.db.prepare(
      `SELECT * FROM messages ORDER BY timestamp ASC`
    ).all() as Record<string, unknown>[]
    return rows.map(parseRow)
  }

  async clear(): Promise<void> {
    this.db.exec(`DELETE FROM messages`)
  }

  async count(): Promise<number> {
    const row = this.db.prepare(`SELECT COUNT(*) as c FROM messages`).get() as { c: number }
    return row.c
  }

  async needsCompression(threshold = SqliteHistory.DEFAULT_COMPRESS_THRESHOLD): Promise<boolean> {
    return (await this.count()) > threshold
  }

  async compressWithSummary(summary: string, keepRecentCount: number): Promise<void> {
    const recent = await this.getRecent(keepRecentCount)
    this.db.exec(`DELETE FROM messages`)

    const insert = this.db.prepare(
      `INSERT INTO messages (id, role, content, timestamp, agent_id) VALUES ($id, $role, $content, $timestamp, $agent_id)`
    )

    insert.run({
      id: randomUUID(),
      role: 'system',
      content: `[Conversation summary] ${summary}`,
      timestamp: new Date().toISOString(),
      agent_id: null,
    })

    for (const msg of recent) {
      insert.run({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        agent_id: (msg as any).agentId ?? null,
      })
    }
  }
}

function parseRow(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    role: row.role as Message['role'],
    content: row.content as string,
    timestamp: new Date(row.timestamp as string),
    agentId: (row.agent_id as string | null) ?? undefined,
  }
}

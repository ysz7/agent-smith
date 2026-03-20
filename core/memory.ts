import { randomUUID } from 'crypto'
import type { IStorage, Message } from './interfaces'

const HISTORY_KEY = 'memory:history'
const DEFAULT_COMPRESS_THRESHOLD = 30

export class Memory {
  constructor(private storage: IStorage) {}

  async add(msg: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
    const message: Message = {
      id: randomUUID(),
      timestamp: new Date(),
      ...msg,
    }
    const history = await this.loadHistory()
    history.push(message)
    await this.storage.set(HISTORY_KEY, history)
  }

  async getRecent(count: number): Promise<Message[]> {
    const history = await this.loadHistory()
    return history.slice(-count)
  }

  async getAll(): Promise<Message[]> {
    return this.loadHistory()
  }

  async clear(): Promise<void> {
    await this.storage.set(HISTORY_KEY, [])
  }

  async count(): Promise<number> {
    const history = await this.loadHistory()
    return history.length
  }

  async needsCompression(threshold = DEFAULT_COMPRESS_THRESHOLD): Promise<boolean> {
    return (await this.count()) > threshold
  }

  // Called by agent after generating a summary via Claude
  async compressWithSummary(summary: string, keepRecentCount: number): Promise<void> {
    const history = await this.loadHistory()
    const recent = history.slice(-keepRecentCount)
    const compressed: Message[] = [
      {
        id: randomUUID(),
        role: 'system',
        content: `[Conversation summary] ${summary}`,
        timestamp: new Date(),
      },
      ...recent,
    ]
    await this.storage.set(HISTORY_KEY, compressed)
  }

  private async loadHistory(): Promise<Message[]> {
    const history = await this.storage.get(HISTORY_KEY)
    if (!Array.isArray(history)) return []
    return history.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }))
  }
}

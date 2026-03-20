import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import type { IStorage } from '@agent-smith/core'

export class LocalStorage implements IStorage {
  private dataDir: string

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? path.join(os.homedir(), '.agent-smith', 'data')
  }

  async get(key: string): Promise<any> {
    const filePath = this.keyToPath(key)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async set(key: string, value: any): Promise<void> {
    const filePath = this.keyToPath(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const handle = await fs.open(filePath, 'w')
    try {
      await handle.writeFile(JSON.stringify(value, null, 2), 'utf-8')
    } finally {
      await handle.close()
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.keyToPath(key)
    try {
      await fs.unlink(filePath)
    } catch {
      // File already gone — that's fine
    }
  }

  async list(prefix?: string): Promise<string[]> {
    try {
      const entries = await this.listDir(this.dataDir)
      return entries
        .map(e => this.pathToKey(e))
        .filter(k => !prefix || k.startsWith(prefix))
    } catch {
      return []
    }
  }

  // Converts "memory:history" → "<dataDir>/memory/history.json"
  private keyToPath(key: string): string {
    const segments = key.split(':')
    return path.join(this.dataDir, ...segments) + '.json'
  }

  // Converts "<dataDir>/memory/history.json" → "memory:history"
  private pathToKey(filePath: string): string {
    const relative = path.relative(this.dataDir, filePath)
    const withoutExt = relative.replace(/\.json$/, '')
    return withoutExt.split(path.sep).join(':')
  }

  private async listDir(dir: string): Promise<string[]> {
    const results: string[] = []
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return []
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      const stat = await fs.stat(fullPath).catch(() => null)
      if (!stat) continue
      if (stat.isDirectory()) {
        results.push(...(await this.listDir(fullPath)))
      } else if (entry.endsWith('.json')) {
        results.push(fullPath)
      }
    }
    return results
  }
}

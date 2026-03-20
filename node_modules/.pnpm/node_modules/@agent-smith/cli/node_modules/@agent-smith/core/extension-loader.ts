import * as fs from 'fs/promises'
import * as path from 'path'
import type { ExtensionAPI, Tool, IStorage, AgentConfig } from './interfaces'

export class ExtensionLoader {
  private tools: Tool[] = []
  private loadedNames: string[] = []

  constructor(
    private config: AgentConfig,
    private storage: IStorage,
    private extensionDirs: string[],
  ) {}

  async load(): Promise<void> {
    this.tools = []
    this.loadedNames = []
    for (const dir of this.extensionDirs) {
      await this.loadFromDir(dir)
    }
  }

  getTools(): Tool[] {
    return [...this.tools]
  }

  getLoadedNames(): string[] {
    return [...this.loadedNames]
  }

  private async loadFromDir(dir: string): Promise<void> {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const extConfig = this.config.extensions[entry]
      if (extConfig?.enabled === false) continue

      // Try compiled JS first, then fall back to direct require
      const indexPath = path.join(dir, entry, 'dist', 'index.js')
      const indexFallback = path.join(dir, entry, 'index.js')

      let register: ((api: ExtensionAPI) => void) | undefined

      for (const tryPath of [indexPath, indexFallback]) {
        try {
          const mod = require(tryPath)
          register = mod.default ?? mod
          break
        } catch {
          // Try next path
        }
      }

      if (!register) continue

      this.loadedNames.push(entry)

      const api: ExtensionAPI = {
        registerTool: (tool: Tool) => this.tools.push(tool),
        storage: this.storage,
        config: this.config,
      }

      try {
        register(api)
      } catch (err: any) {
        console.warn(`Extension "${entry}" failed to register:`, err?.message)
      }
    }
  }
}

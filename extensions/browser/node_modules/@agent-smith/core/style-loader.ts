import * as fs from 'fs/promises'
import * as path from 'path'

export interface ResponseStyle {
  name: string
  description: string
  instructions: string
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw.trim() }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx !== -1) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return { meta, body: match[2].trim() }
}

export class StyleLoader {
  constructor(private styleDirs: string[]) {}

  async list(): Promise<ResponseStyle[]> {
    const seen = new Map<string, ResponseStyle>()

    for (const dir of this.styleDirs) {
      let entries: string[]
      try {
        const dirents = await fs.readdir(dir, { withFileTypes: true })
        entries = dirents.filter(d => d.isDirectory()).map(d => d.name)
      } catch {
        continue
      }

      for (const entry of entries) {
        const stylePath = path.join(dir, entry, 'STYLE.md')
        try {
          const raw = await fs.readFile(stylePath, 'utf-8')
          const { meta, body } = parseFrontmatter(raw)
          const name = meta.name ?? entry
          seen.set(name, {
            name,
            description: meta.description ?? '',
            instructions: body,
          })
        } catch {
          // skip unreadable
        }
      }
    }

    return Array.from(seen.values())
  }

  async load(name: string): Promise<ResponseStyle | null> {
    const all = await this.list()
    return all.find(s => s.name === name) ?? null
  }
}

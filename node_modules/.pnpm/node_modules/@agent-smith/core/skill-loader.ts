import * as fs from 'fs/promises'
import * as path from 'path'
import matter from 'gray-matter'
import chokidar from 'chokidar'
import type { Skill, AgentConfig } from './interfaces'

export class SkillLoader {
  private skills: Skill[] = []
  private watcher?: chokidar.FSWatcher
  private debounceTimer?: NodeJS.Timeout

  constructor(
    private config: AgentConfig,
    // Priority order: workspace > user > built-in (last wins on name collision)
    private skillDirs: string[],
  ) {}

  async load(): Promise<Skill[]> {
    this.skills = []
    for (const dir of this.skillDirs) {
      await this.loadFromDir(dir)
    }
    return [...this.skills]
  }

  async watch(onChange: (skills: Skill[]) => void): Promise<void> {
    const existingDirs: string[] = []
    for (const dir of this.skillDirs) {
      try {
        await fs.access(dir)
        existingDirs.push(dir)
      } catch {
        // Skip non-existent directories
      }
    }

    if (existingDirs.length === 0) return

    this.watcher = chokidar.watch(existingDirs, { ignoreInitial: true })

    const reload = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(async () => {
        const skills = await this.load()
        onChange(skills)
      }, 500)
    }

    this.watcher.on('add', reload)
    this.watcher.on('change', reload)
    this.watcher.on('unlink', reload)
  }

  getSkills(): Skill[] {
    return [...this.skills]
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.watcher) await this.watcher.close()
  }

  private async loadFromDir(dir: string): Promise<void> {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const skillPath = path.join(dir, entry, 'SKILL.md')
      try {
        const raw = await fs.readFile(skillPath, 'utf-8')
        const { data, content } = matter(raw)

        const skillName: string = data.name ?? entry
        const configEntry = this.config.skills[skillName]

        // Not in config → enabled by default
        const enabledByConfig = configEntry?.enabled ?? true

        // Check if required extensions are enabled
        const requires: string[] = data.requires?.extensions ?? []
        const hasDisabledExtension = requires.some(ext => {
          const extConfig = this.config.extensions[ext]
          return extConfig?.enabled === false
        })

        const skill: Skill = {
          name: skillName,
          description: data.description ?? '',
          enabled: enabledByConfig && !hasDisabledExtension,
          requires: requires.length > 0 ? { extensions: requires } : undefined,
          config: { ...(data.config ?? {}), ...(configEntry?.config ?? {}) },
          instructions: content.trim(),
        }

        // Override if already loaded (later dirs have higher priority)
        const existingIdx = this.skills.findIndex(s => s.name === skillName)
        if (existingIdx >= 0) {
          this.skills[existingIdx] = skill
        } else {
          this.skills.push(skill)
        }
      } catch {
        // Skip invalid or missing SKILL.md
      }
    }
  }
}

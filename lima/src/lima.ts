import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { randomBytes } from 'crypto'
import { initSchema } from './schema'
import { extractTags, chunkText } from './tags'
import type {
  ILimaMemory, Fact, StoreFact, TaskFact, RecallResult,
  ListFilter, DeleteFilter, IngestOptions, LimaStats, Step,
} from './types'

const MAX_FACTS_IN_CONTEXT = 12
const DECAY_FACTOR = 0.85
const DECAY_MIN = 0.10
const TOPIC_SHIFT_THRESHOLD = 0.20
const LINK_DECAY = [1.0, 0.7, 0.5] // depth 0, 1, 2

function newId(prefix = 'f'): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`
}

function now(): string {
  return new Date().toISOString()
}

// Cast dynamic param objects to SQLInputValue-compatible type
function sp(params: Record<string, unknown>): Record<string, SQLInputValue> {
  return params as Record<string, SQLInputValue>
}

function parseRow(row: Record<string, unknown>): Fact {
  return {
    ...row,
    tags: JSON.parse(row.tags as string),
    links: row.links ? JSON.parse(row.links as string) : undefined,
    steps: row.steps ? JSON.parse(row.steps as string) : undefined,
    errors: row.errors ? JSON.parse(row.errors as string) : undefined,
    checkpoint: row.checkpoint ? JSON.parse(row.checkpoint as string) : undefined,
    viewed_by_user: Boolean(row.viewed_by_user),
  } as Fact
}

export class LimaMemory implements ILimaMemory {
  private db: DatabaseSync
  private prevTags: string[] = []

  constructor(dbPath?: string) {
    const resolved = dbPath ?? path.join(os.homedir(), '.agent-smith', 'lima.db')
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    this.db = new DatabaseSync(resolved)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    initSchema(this.db)
  }

  // ─── store ────────────────────────────────────────────────────────────────

  async store(input: StoreFact): Promise<string> {
    const id = newId(input.scope === 'task' ? 't' : 'f')
    const tags = input.tags ?? extractTags(input.content)
    const ts = now()
    const summaryEn = input.content.slice(0, 120)

    this.db.prepare(`
      INSERT INTO facts
        (id, content, summary_en, summary_orig, tags, scope, source, weight, activation,
         created, last_used, use_count, ttl, links, source_url, chunk_index,
         goal, status, steps, errors, checkpoint)
      VALUES
        ($id, $content, $summary_en, $summary_orig, $tags, $scope, $source, $weight, 0,
         $created, $last_used, 0, $ttl, $links, $source_url, $chunk_index,
         $goal, $status, $steps, $errors, $checkpoint)
    `).run({
      id,
      content: input.content,
      summary_en: summaryEn,
      summary_orig: input.content.slice(0, 120),
      tags: JSON.stringify(tags),
      scope: input.scope,
      source: input.source,
      weight: input.weight ?? 0.5,
      created: ts,
      last_used: ts,
      ttl: input.ttl ?? (input.scope === 'working' ? this.defaultTtl(24) : null),
      links: input.links ? JSON.stringify(input.links) : null,
      source_url: input.source_url ?? null,
      chunk_index: input.chunk_index ?? null,
      goal: input.goal ?? null,
      status: input.scope === 'task' ? 'in_progress' : null,
      steps: input.steps ? JSON.stringify(input.steps) : null,
      errors: input.scope === 'task' ? JSON.stringify([]) : null,
      checkpoint: null,
    })

    return id
  }

  // ─── recall ───────────────────────────────────────────────────────────────

  async recall(query: string): Promise<RecallResult> {
    const queryTags = extractTags(query)

    // Step 1: profile — always load
    const profileFacts = this.db.prepare(
      `SELECT * FROM facts WHERE scope = 'profile' ORDER BY weight DESC LIMIT 10`
    ).all() as Record<string, unknown>[]

    // Step 2: active task — always load
    const taskFact = this.db.prepare(
      `SELECT * FROM facts WHERE scope = 'task' AND status IN ('in_progress','paused') LIMIT 1`
    ).get() as Record<string, unknown> | undefined

    // Step 3: topic shift detection
    if (this.prevTags.length > 0) {
      const union = new Set([...queryTags, ...this.prevTags])
      const intersection = queryTags.filter(t => this.prevTags.includes(t))
      const overlap = union.size > 0 ? intersection.length / union.size : 0
      if (overlap < TOPIC_SHIFT_THRESHOLD) {
        this.db.exec(`UPDATE facts SET activation = 0 WHERE scope IN ('working','knowledge')`)
      }
    }
    this.prevTags = queryTags

    // Step 4+5: tag lookup via FTS5
    const recalled = new Map<string, number>()
    const ftsStmt = this.db.prepare(
      `SELECT f.id FROM facts f
       JOIN facts_fts fts ON fts.id = f.id
       WHERE fts.tags MATCH $tag AND f.scope IN ('working','knowledge')
       LIMIT 20`
    )
    for (const tag of queryTags) {
      const rows = ftsStmt.all({ tag }) as { id: string }[]
      for (const row of rows) {
        recalled.set(row.id, (recalled.get(row.id) ?? 0) + 1)
      }
    }

    // Step 6: activation propagation (depth 2)
    const activated = new Map<string, number>()
    const linksStmt = this.db.prepare(`SELECT links FROM facts WHERE id = $id`)
    for (const [id, score] of recalled) {
      activated.set(id, score)
      const fact = linksStmt.get({ id }) as { links: string } | undefined
      if (!fact?.links) continue
      const links: string[] = JSON.parse(fact.links)
      for (const linkedId of links) {
        const current = activated.get(linkedId) ?? 0
        activated.set(linkedId, Math.max(current, score * LINK_DECAY[1]))
        // depth 2
        const linked = linksStmt.get({ id: linkedId }) as { links: string } | undefined
        if (!linked?.links) continue
        const links2: string[] = JSON.parse(linked.links)
        for (const id2 of links2) {
          const c2 = activated.get(id2) ?? 0
          activated.set(id2, Math.max(c2, score * LINK_DECAY[2]))
        }
      }
    }

    // Update activations in DB
    const updateAct = this.db.prepare(`UPDATE facts SET activation = $activation WHERE id = $id`)
    for (const [id, activation] of activated) {
      updateAct.run({ activation, id })
    }

    // Step 7: select top N by activation
    const topIds = Array.from(activated.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_FACTS_IN_CONTEXT)
      .map(([id]) => id)

    let recalledFacts: Fact[] = []
    if (topIds.length > 0) {
      const placeholders = topIds.map((_, i) => `$id${i}`).join(',')
      const idParams = Object.fromEntries(topIds.map((id, i) => [`id${i}`, id]))
      const rows = this.db.prepare(
        `SELECT * FROM facts WHERE id IN (${placeholders}) ORDER BY activation DESC`
      ).all(idParams) as Record<string, unknown>[]
      recalledFacts = rows.map(parseRow)

      // Update use_count and last_used
      this.db.prepare(
        `UPDATE facts SET use_count = use_count + 1, last_used = $ts, weight = MIN(1.0, weight + 0.01) WHERE id IN (${placeholders})`
      ).run({ ts: now(), ...idParams })
    }

    const profile = profileFacts.map(parseRow)
    const task = taskFact ? parseRow(taskFact) : null

    const contextBlock = this.buildContextBlock(profile, task as TaskFact | null, recalledFacts)

    return { facts: [...profile, ...(task ? [task] : []), ...recalledFacts], contextBlock }
  }

  // ─── decay ────────────────────────────────────────────────────────────────

  async decay(): Promise<void> {
    this.db.prepare(
      `UPDATE facts SET activation = activation * $factor WHERE scope IN ('working','knowledge')`
    ).run({ factor: DECAY_FACTOR })

    this.db.prepare(
      `UPDATE facts SET activation = 0 WHERE scope IN ('working','knowledge') AND activation < $min`
    ).run({ min: DECAY_MIN })

    this.db.prepare(
      `DELETE FROM facts WHERE ttl IS NOT NULL AND ttl < $ts`
    ).run({ ts: now() })
  }

  // ─── forget ───────────────────────────────────────────────────────────────

  async forget(threshold: number): Promise<number> {
    const result = this.db.prepare(
      `DELETE FROM facts WHERE weight < $threshold AND scope != 'profile'`
    ).run({ threshold })
    return result.changes as number
  }

  // ─── resetContext ─────────────────────────────────────────────────────────

  async resetContext(): Promise<void> {
    this.db.exec(`UPDATE facts SET activation = 0 WHERE scope IN ('working','knowledge')`)
    this.prevTags = []
  }

  // ─── get ──────────────────────────────────────────────────────────────────

  async get(id: string): Promise<Fact | null> {
    const row = this.db.prepare(`SELECT * FROM facts WHERE id = $id`).get({ id }) as Record<string, unknown> | undefined
    return row ? parseRow(row) : null
  }

  // ─── tasks ────────────────────────────────────────────────────────────────

  async startTask(goal: string, steps: { action: string }[], options?: { ttl?: string }): Promise<string> {
    this.db.exec(`UPDATE facts SET status = 'paused' WHERE scope = 'task' AND status = 'in_progress'`)

    const id = newId('t')
    const ts = now()
    const fullSteps: Step[] = steps.map(s => ({ action: s.action, status: 'pending' as const }))

    this.db.prepare(`
      INSERT INTO facts
        (id, content, summary_en, summary_orig, tags, scope, source, weight, activation,
         created, last_used, use_count, ttl, goal, status, steps, errors, checkpoint)
      VALUES
        ($id, $content, $content, $content, $tags, 'task', 'agent', 1.0, 1.0,
         $created, $created, 0, $ttl, $goal, 'in_progress', $steps, '[]', NULL)
    `).run({
      id,
      content: `Task: ${goal}`,
      tags: JSON.stringify(extractTags(goal)),
      created: ts,
      ttl: options?.ttl ?? this.defaultTtl(48),
      goal,
      steps: JSON.stringify(fullSteps),
    })

    return id
  }

  async updateTask(taskId: string, patch: Partial<Pick<TaskFact, 'steps' | 'errors' | 'checkpoint' | 'status'>>): Promise<void> {
    const updates: string[] = ['last_used = $ts']
    const params: Record<string, unknown> = { ts: now(), taskId }

    if (patch.steps !== undefined) { updates.push('steps = $steps'); params.steps = JSON.stringify(patch.steps) }
    if (patch.errors !== undefined) { updates.push('errors = $errors'); params.errors = JSON.stringify(patch.errors) }
    if (patch.checkpoint !== undefined) { updates.push('checkpoint = $checkpoint'); params.checkpoint = JSON.stringify(patch.checkpoint) }
    if (patch.status !== undefined) { updates.push('status = $status'); params.status = patch.status }

    this.db.prepare(`UPDATE facts SET ${updates.join(', ')} WHERE id = $taskId`).run(sp(params))
  }

  async getActiveTask(): Promise<TaskFact | null> {
    const row = this.db.prepare(
      `SELECT * FROM facts WHERE scope = 'task' AND status IN ('in_progress','paused') ORDER BY last_used DESC LIMIT 1`
    ).get() as Record<string, unknown> | undefined
    return row ? parseRow(row) as TaskFact : null
  }

  // ─── ingestion ────────────────────────────────────────────────────────────

  async ingestFile(filePath: string, options?: IngestOptions): Promise<number> {
    const resolved = filePath.startsWith('~')
      ? path.join(os.homedir(), filePath.slice(1))
      : path.resolve(filePath)

    const ext = path.extname(resolved).toLowerCase()
    let text: string

    if (ext === '.txt' || ext === '.md') {
      text = await fsp.readFile(resolved, 'utf-8')
    } else if (ext === '.pdf') {
      const pdfMod = await import('pdf-parse')
      const pdfParse = (pdfMod as any).default ?? pdfMod
      const buffer = await fsp.readFile(resolved)
      const data = await pdfParse(buffer)
      text = data.text
    } else if (ext === '.docx') {
      const { default: mammoth } = await import('mammoth')
      const result = await mammoth.extractRawText({ path: resolved })
      text = result.value
    } else {
      throw new Error(`Unsupported file type: ${ext}. Supported: .txt, .md, .pdf, .docx`)
    }

    return this.ingestText(text, { ...options, source_url: resolved, source: 'document' })
  }

  async listDocuments(): Promise<{ source_url: string; name: string; chunks: number; indexed: string }[]> {
    const rows = this.db.prepare(
      `SELECT source_url, COUNT(*) as chunks, MIN(created) as indexed
       FROM facts WHERE source = 'document' AND source_url IS NOT NULL
       GROUP BY source_url ORDER BY indexed DESC`
    ).all() as { source_url: string; chunks: number; indexed: string }[]
    return rows.map(r => ({ ...r, name: path.basename(r.source_url) }))
  }

  async deleteDocument(sourceUrl: string): Promise<number> {
    const result = this.db.prepare(
      `DELETE FROM facts WHERE source_url = $source_url`
    ).run({ source_url: sourceUrl })
    return result.changes as number
  }

  async ingestURL(url: string, options?: IngestOptions & { depth?: number }): Promise<number> {
    const { default: axios } = await import('axios')
    const { load } = await import('cheerio')

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
    })
    const $ = load(response.data as string)
    $('script,style,nav,footer,header').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim()

    return this.ingestText(text, { ...options, source_url: url, source: 'webpage' })
  }

  async ingestFolder(dirPath: string, options?: IngestOptions & { extensions?: string[]; recursive?: boolean }): Promise<number> {
    const resolved = dirPath.startsWith('~')
      ? path.join(os.homedir(), dirPath.slice(1))
      : path.resolve(dirPath)

    const exts = options?.extensions ?? ['.txt', '.md']
    const files: string[] = []

    const collect = async (dir: string, depth: number): Promise<void> => {
      if (depth > 5) return
      const entries = await fsp.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory() && options?.recursive !== false) await collect(full, depth + 1)
        else if (entry.isFile() && exts.includes(path.extname(entry.name).toLowerCase())) files.push(full)
      }
    }
    await collect(resolved, 0)

    let count = 0
    for (const file of files) {
      const text = await fsp.readFile(file, 'utf-8')
      count += await this.ingestText(text, { ...options, source_url: file, source: 'document' })
    }
    return count
  }

  // ─── link ─────────────────────────────────────────────────────────────────

  async link(id1: string, id2: string): Promise<void> {
    const addLink = (id: string, target: string) => {
      const row = this.db.prepare(`SELECT links FROM facts WHERE id = $id`).get({ id }) as { links: string } | undefined
      if (!row) return
      const links: string[] = row.links ? JSON.parse(row.links) : []
      if (!links.includes(target)) {
        links.push(target)
        this.db.prepare(`UPDATE facts SET links = $links WHERE id = $id`).run({ links: JSON.stringify(links), id })
      }
    }
    addLink(id1, id2)
    addLink(id2, id1)
  }

  // ─── user-facing memory control ───────────────────────────────────────────

  async listMemory(filter?: ListFilter): Promise<Fact[]> {
    const conditions: string[] = ['1=1']
    const params: Record<string, unknown> = {}

    if (filter?.scope) { conditions.push(`scope = $scope`); params.scope = filter.scope }
    if (filter?.source) { conditions.push(`source = $source`); params.source = filter.source }
    if (filter?.since) { conditions.push(`created >= $since`); params.since = filter.since }

    let query = `SELECT * FROM facts WHERE ${conditions.join(' AND ')} ORDER BY weight DESC, last_used DESC`
    if (filter?.limit) { query += ` LIMIT $limit`; params.limit = filter.limit }

    const rows = this.db.prepare(query).all(sp(params)) as Record<string, unknown>[]

    if (rows.length > 0) {
      const ids = rows.map(r => r.id as string)
      const placeholders = ids.map((_, i) => `$id${i}`).join(',')
      const idParams = Object.fromEntries(ids.map((id, i) => [`id${i}`, id]))
      this.db.prepare(`UPDATE facts SET viewed_by_user = 1 WHERE id IN (${placeholders})`).run(sp(idParams))
    }

    return rows.map(parseRow)
  }

  async deleteMemory(idOrFilter: string | DeleteFilter): Promise<number> {
    if (typeof idOrFilter === 'string') {
      const result = this.db.prepare(`DELETE FROM facts WHERE id = $id`).run({ id: idOrFilter })
      return result.changes as number
    }

    const conditions: string[] = ['1=1']
    const params: Record<string, unknown> = {}
    if (idOrFilter.scope) { conditions.push(`scope = $scope`); params.scope = idOrFilter.scope }
    if (idOrFilter.source) { conditions.push(`source = $source`); params.source = idOrFilter.source }
    if (idOrFilter.source_url) { conditions.push(`source_url = $source_url`); params.source_url = idOrFilter.source_url }

    const result = this.db.prepare(`DELETE FROM facts WHERE ${conditions.join(' AND ')}`).run(sp(params))
    return result.changes as number
  }

  // ─── optional ─────────────────────────────────────────────────────────────

  async stats(): Promise<LimaStats> {
    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM facts`).get() as { c: number }).c
    const byScope = Object.fromEntries(
      (this.db.prepare(`SELECT scope, COUNT(*) as c FROM facts GROUP BY scope`).all() as { scope: string; c: number }[])
        .map(r => [r.scope, r.c])
    ) as Record<string, number>
    const bySource = Object.fromEntries(
      (this.db.prepare(`SELECT source, COUNT(*) as c FROM facts GROUP BY source`).all() as { source: string; c: number }[])
        .map(r => [r.source, r.c])
    ) as Record<string, number>

    return {
      total,
      byScope: byScope as LimaStats['byScope'],
      bySource,
      dbSizeBytes: 0,
    }
  }

  async export(filePath: string): Promise<void> {
    const rows = this.db.prepare(`SELECT * FROM facts`).all()
    await fsp.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8')
  }

  async import(filePath: string): Promise<number> {
    const data = JSON.parse(await fsp.readFile(filePath, 'utf-8')) as Record<string, unknown>[]
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO facts
        (id,content,summary_en,summary_orig,tags,scope,source,weight,activation,
         created,last_used,use_count,ttl,links,source_url,chunk_index,
         viewed_by_user,goal,status,steps,errors,checkpoint)
      VALUES
        ($id,$content,$summary_en,$summary_orig,$tags,$scope,$source,$weight,$activation,
         $created,$last_used,$use_count,$ttl,$links,$source_url,$chunk_index,
         $viewed_by_user,$goal,$status,$steps,$errors,$checkpoint)
    `)
    for (const row of data) {
      insert.run(sp(row))
    }
    return data.length
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private defaultTtl(hours: number): string {
    return new Date(Date.now() + hours * 3600_000).toISOString()
  }

  private async ingestText(
    text: string,
    opts: IngestOptions & { source_url?: string; source: 'document' | 'webpage' | 'knowledge-base' },
  ): Promise<number> {
    const chunks = chunkText(text, opts.chunkSize ?? 200, opts.chunkOverlap ?? 20)
    let count = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (!chunk?.trim()) continue
      await this.store({
        content: chunk,
        scope: 'knowledge',
        source: opts.source,
        weight: opts.weight ?? 0.8,
        tags: [...(opts.tags ?? []), ...extractTags(chunk)].slice(0, 10),
        source_url: opts.source_url,
        chunk_index: i,
      })
      count++
    }
    return count
  }

  async searchDocuments(query: string, limit = 8): Promise<{ content: string; source: string; chunk_index?: number }[]> {
    const tags = extractTags(query)
    if (tags.length === 0) {
      // fallback: return most recent document facts
      const rows = this.db.prepare(
        `SELECT content, source_url, chunk_index FROM facts WHERE source = 'document' ORDER BY last_used DESC LIMIT $limit`
      ).all({ limit }) as { content: string; source_url: string; chunk_index: number | null }[]
      return rows.map(r => ({
        content: r.content,
        source: r.source_url ? path.basename(r.source_url) : 'unknown',
        chunk_index: r.chunk_index ?? undefined,
      }))
    }

    const scored = new Map<string, number>()
    const stmt = this.db.prepare(
      `SELECT f.id FROM facts f
       JOIN facts_fts fts ON fts.id = f.id
       WHERE f.source = 'document' AND fts.tags MATCH $tag`
    )
    for (const tag of tags) {
      const rows = stmt.all({ tag }) as { id: string }[]
      for (const r of rows) scored.set(r.id, (scored.get(r.id) ?? 0) + 1)
    }

    const topIds = [...scored.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)

    if (topIds.length === 0) return []

    const placeholders = topIds.map((_, i) => `$id${i}`).join(',')
    const idParams = Object.fromEntries(topIds.map((id, i) => [`id${i}`, id]))
    const rows = this.db.prepare(
      `SELECT content, source_url, chunk_index FROM facts WHERE id IN (${placeholders})`
    ).all(idParams) as { content: string; source_url: string | null; chunk_index: number | null }[]

    return rows.map(r => ({
      content: r.content,
      source: r.source_url ? path.basename(r.source_url) : 'unknown',
      chunk_index: r.chunk_index ?? undefined,
    }))
  }

  private buildContextBlock(profile: Fact[], task: TaskFact | null, recalled: Fact[]): string {
    const lines: string[] = []

    if (profile.length > 0) {
      lines.push('[profile]')
      for (const f of profile) lines.push(`  ${f.summary_en}`)
    }

    if (task) {
      lines.push('[task]')
      lines.push(`  Goal: ${task.goal}`)
      if (task.steps) {
        for (const s of task.steps) {
          const marker = s.status === 'completed' ? '✓' : s.status === 'in_progress' ? '→' : '·'
          lines.push(`  ${marker} ${s.action}${s.result ? `: ${s.result}` : ''}`)
        }
      }
    }

    if (recalled.length > 0) {
      const byScope: Record<string, Fact[]> = {}
      for (const f of recalled) {
        ;(byScope[f.scope] ??= []).push(f)
      }
      for (const [scope, facts] of Object.entries(byScope)) {
        lines.push(`[${scope}]`)
        for (const f of facts) {
          // For document chunks, show the source filename so agent can cite it
          if (f.source === 'document' && f.source_url) {
            lines.push(`  [doc:${path.basename(f.source_url)}] ${f.summary_en}`)
          } else {
            lines.push(`  ${f.summary_en}`)
          }
        }
      }
    }

    // Hard cap: ~800 tokens ≈ 3200 chars
    const block = lines.join('\n')
    return block.length > 3200 ? block.slice(0, 3200) + '\n...' : block
  }

  async resetAll(): Promise<void> {
    this.db.exec('DELETE FROM facts')
    this.db.exec('DELETE FROM messages')
    this.prevTags = []
  }

  async resetHistory(): Promise<void> {
    this.db.exec('DELETE FROM messages')
  }

  async resetFacts(): Promise<void> {
    this.db.exec('DELETE FROM facts')
    this.prevTags = []
  }

  getDb(): DatabaseSync {
    return this.db
  }

  close(): void {
    this.db.close()
  }
}

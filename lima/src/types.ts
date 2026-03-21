export type Scope = 'profile' | 'knowledge' | 'working' | 'task'
export type Source = 'user' | 'agent' | 'conversation' | 'document' | 'webpage' | 'knowledge-base'
export type TaskStatus = 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed'
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface Step {
  action: string
  status: StepStatus
  result?: string
}

export interface Fact {
  id: string
  content: string
  summary_en: string
  summary_orig: string
  tags: string[]
  scope: Scope
  source: Source
  weight: number        // long-term importance 0.0–1.0
  activation: number    // per-turn relevance 0.0–1.0
  created: string       // ISO 8601
  last_used: string     // ISO 8601
  use_count: number
  ttl?: string          // ISO 8601, required for working/task
  links?: string[]      // IDs of associated facts
  chunk_index?: number
  source_url?: string
  viewed_by_user?: boolean
  // task-specific fields
  goal?: string
  status?: TaskStatus
  steps?: Step[]
  errors?: string[]
  checkpoint?: Record<string, unknown>
}

export interface StoreFact {
  content: string
  scope: Scope
  source: Source
  weight?: number
  tags?: string[]
  ttl?: string
  links?: string[]
  source_url?: string
  chunk_index?: number
  // task fields
  goal?: string
  steps?: Step[]
}

export interface RecallResult {
  facts: Fact[]
  contextBlock: string   // ready-to-inject string, ~800 tokens max
}

export interface ListFilter {
  scope?: Scope
  source?: Source
  since?: string
  limit?: number
}

export interface DeleteFilter {
  scope?: Scope
  source?: Source
  source_url?: string
}

export interface IngestOptions {
  tags?: string[]
  weight?: number
  chunkSize?: number    // words per chunk, default 200
  chunkOverlap?: number // words overlap, default 20
}

export interface TaskFact extends Fact {
  scope: 'task'
  goal: string
  status: TaskStatus
  steps: Step[]
  errors: string[]
  ttl: string
}

export interface LimaStats {
  total: number
  byScope: Record<Scope, number>
  bySource: Record<string, number>
  dbSizeBytes: number
}

// The interface — implement this to replace LIMA with a different backend
export interface ILimaMemory {
  // Core
  store(fact: StoreFact): Promise<string>
  recall(query: string): Promise<RecallResult>
  decay(): Promise<void>
  forget(threshold: number): Promise<number>
  resetContext(): Promise<void>
  get(id: string): Promise<Fact | null>

  // Tasks
  startTask(goal: string, steps: { action: string }[], options?: { ttl?: string }): Promise<string>
  updateTask(taskId: string, patch: Partial<Pick<TaskFact, 'steps' | 'errors' | 'checkpoint' | 'status'>>): Promise<void>
  getActiveTask(): Promise<TaskFact | null>

  // Ingestion
  ingestFile(filePath: string, options?: IngestOptions): Promise<number>
  ingestURL(url: string, options?: IngestOptions & { depth?: number }): Promise<number>
  ingestFolder(dirPath: string, options?: IngestOptions & { extensions?: string[]; recursive?: boolean }): Promise<number>

  // Links
  link(id1: string, id2: string): Promise<void>

  // User-facing
  listMemory(filter?: ListFilter): Promise<Fact[]>
  deleteMemory(idOrFilter: string | DeleteFilter): Promise<number>

  // Optional
  stats?(): Promise<LimaStats>
  export?(filePath: string): Promise<void>
  import?(filePath: string): Promise<number>
  resetAll?(): Promise<void>
  resetHistory?(): Promise<void>
  resetFacts?(): Promise<void>
  listDocuments?(): Promise<{ source_url: string; name: string; chunks: number; indexed: string }[]>
  deleteDocument?(sourceUrl: string): Promise<number>
  searchDocuments?(query: string, limit?: number): Promise<{ content: string; source: string; chunk_index?: number }[]>
}

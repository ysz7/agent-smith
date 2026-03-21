import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/chat'
import { useConfigStore } from '@/store/config'

const API = import.meta.env.DEV ? 'http://localhost:3000' : ''

type Scope = 'profile' | 'knowledge' | 'working' | 'task'

interface Fact {
  id: string
  content: string
  summary_en: string
  tags: string[]
  scope: Scope
  source: string
  weight: number
  created: string
  last_used: string
  use_count: number
}

interface Stats {
  total: number
  byScope: Partial<Record<Scope, number>>
  bySource: Record<string, number>
}

const SCOPE_COLORS: Record<Scope, string> = {
  profile: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  knowledge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  working: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  task: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
}

const ALL_SCOPES: Scope[] = ['profile', 'knowledge', 'working', 'task']

export default function MemorySection() {
  const [facts, setFacts] = useState<Fact[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [scope, setScope] = useState<Scope | ''>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [resettingHistory, setResettingHistory] = useState(false)
  const [resettingFacts, setResettingFacts] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const clearMessages = useChatStore(s => s.clearMessages)
  const { config, updateConfig } = useConfigStore()
  const limaEnabled = config?.performance?.limaEnabled !== false

  const toggleLima = async (val: boolean) => {
    await updateConfig({ performance: { ...config?.performance, limaEnabled: val } as any })
  }

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/memory/stats`)
      if (res.ok) setStats(await res.json())
    } catch { /* ignore */ }
  }, [])

  const loadFacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (scope) params.set('scope', scope)
      params.set('limit', '100')
      const res = await fetch(`${API}/api/memory?${params}`)
      if (res.ok) setFacts(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [scope])

  useEffect(() => {
    loadStats()
    loadFacts()
  }, [loadStats, loadFacts])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`${API}/api/memory/${id}`, { method: 'DELETE' })
      setFacts(prev => prev.filter(f => f.id !== id))
      await loadStats()
    } catch { /* ignore */ }
    setDeleting(null)
  }

  const handleClearScope = async (s: Scope) => {
    if (!confirm(`Delete all "${s}" facts? This cannot be undone.`)) return
    try {
      await fetch(`${API}/api/memory`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: s }),
      })
      await loadFacts()
      await loadStats()
    } catch { /* ignore */ }
  }

  const handleResetHistory = async () => {
    if (!confirm('Clear conversation history?\n\nAll chat messages will be deleted. LIMA facts are not affected.\n\nThis cannot be undone.')) return
    setResettingHistory(true)
    try {
      await fetch(`${API}/api/memory/reset-history`, { method: 'POST' })
      clearMessages()
    } catch { /* ignore */ }
    setResettingHistory(false)
  }

  const handleResetFacts = async () => {
    if (!confirm('Clear all LIMA facts?\n\nThis will delete all profile, knowledge, working and task facts. Conversation history is not affected.\n\nThis cannot be undone.')) return
    setResettingFacts(true)
    try {
      await fetch(`${API}/api/memory/reset-facts`, { method: 'POST' })
      setFacts([])
      setStats({ total: 0, byScope: {}, bySource: {} })
    } catch { /* ignore */ }
    setResettingFacts(false)
  }

  const handleExport = () => {
    window.open(`${API}/api/memory/export`, '_blank')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch(`${API}/api/memory/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Import failed')
      await loadFacts()
      await loadStats()
    } catch (err: any) {
      setImportError(err?.message ?? 'Import failed')
    }
    if (importRef.current) importRef.current.value = ''
  }

  const filtered = facts.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.content.toLowerCase().includes(q) ||
      f.tags.some(t => t.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Memory</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Long-term facts stored by LIMA — {stats?.total ?? 0} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            Import
          </Button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">Long-term memory</p>
          <p className="text-xs text-muted-foreground">Recall and store facts across sessions. Disable to save tokens.</p>
        </div>
        <Switch checked={limaEnabled} onCheckedChange={toggleLima} />
      </div>

      {/* Scope stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          {ALL_SCOPES.map(s => (
            <div key={s} className="rounded-lg border bg-card px-3 py-2 text-center">
              <div className="text-lg font-semibold">{stats.byScope[s] ?? 0}</div>
              <div className={cn('text-[11px] font-medium mt-0.5 rounded px-1.5 py-0.5 inline-block', SCOPE_COLORS[s])}>
                {s}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="Search facts or tags..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={scope}
          onChange={e => setScope(e.target.value as Scope | '')}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All scopes</option>
          {ALL_SCOPES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={loadFacts}>
          Refresh
        </Button>
      </div>

      {/* Clear scope button */}
      {scope && (
        <div className="flex justify-end">
          <Button variant="destructive" size="sm" onClick={() => handleClearScope(scope as Scope)}>
            Clear all {scope} facts
          </Button>
        </div>
      )}

      {importError && (
        <p className="text-xs text-destructive">{importError}</p>
      )}

      {/* Facts list */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {facts.length === 0 ? 'No facts stored yet.' : 'No facts match your filter.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(fact => (
            <FactRow
              key={fact.id}
              fact={fact}
              onDelete={handleDelete}
              deleting={deleting === fact.id}
            />
          ))}
        </div>
      )}

      {/* Danger zone */}
      <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 space-y-4">
        <p className="text-sm font-medium text-destructive">Danger Zone</p>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-foreground">Clear conversation</p>
            <p className="text-xs text-muted-foreground">Delete all chat messages. LIMA facts are not affected.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleResetHistory} disabled={resettingHistory} className="shrink-0">
            {resettingHistory ? 'Clearing...' : 'Clear history'}
          </Button>
        </div>

        <div className="border-t border-destructive/20" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-foreground">Clear all facts</p>
            <p className="text-xs text-muted-foreground">Delete all profile, knowledge, working and task facts. Chat history is not affected.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleResetFacts} disabled={resettingFacts} className="shrink-0">
            {resettingFacts ? 'Clearing...' : 'Clear facts'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FactRow({
  fact,
  onDelete,
  deleting,
}: {
  fact: Fact
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border bg-card px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5', SCOPE_COLORS[fact.scope])}>
              {fact.scope}
            </span>
            <span className="text-[10px] text-muted-foreground">{fact.source}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(fact.created).toLocaleDateString()}
            </span>
            <span className="text-[10px] text-muted-foreground">used {fact.use_count}×</span>
          </div>
          <p
            className={cn(
              'text-xs text-foreground/90 cursor-pointer',
              !expanded && 'line-clamp-2',
            )}
            onClick={() => setExpanded(v => !v)}
          >
            {fact.content}
          </p>
          {fact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {fact.tags.slice(0, 8).map(tag => (
                <span
                  key={tag}
                  className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(fact.id)}
          disabled={deleting}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors text-xs disabled:opacity-40"
        >
          {deleting ? '...' : '✕'}
        </button>
      </div>
    </div>
  )
}

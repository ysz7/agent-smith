import { useState } from 'react'
import { Plus, Square, Trash2, Bot, Crown, Pencil, Users } from 'lucide-react'
import { useAgentsStore, type AgentEntry } from '@/store/agents'
import { useConfigStore } from '@/store/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const API = import.meta.env.DEV ? 'http://localhost:3000' : ''

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
]

const STATUS_COLORS: Record<AgentEntry['status'], string> = {
  idle:     'bg-muted-foreground/40',
  thinking: 'bg-yellow-400 animate-pulse',
  working:  'bg-blue-400 animate-pulse',
  stopped:  'bg-red-400',
  error:    'bg-destructive',
}

const STATUS_LABELS: Record<AgentEntry['status'], string> = {
  idle:     'Idle',
  thinking: 'Thinking',
  working:  'Working',
  stopped:  'Stopped',
  error:    'Error',
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onEdit, onDelete, onStop }: {
  agent: AgentEntry
  onEdit: (agent: AgentEntry) => void
  onDelete: (id: string) => void
  onStop: (id: string) => void
}) {
  const isMain = agent.type === 'main'
  const isOrchestrator = agent.type === 'orchestrator'

  return (
    <div className={cn(
      'relative flex flex-col gap-3 rounded-2xl border p-4 transition-colors',
      isMain && 'border-foreground/20 bg-card',
      isOrchestrator && 'border-dashed border-foreground/30 bg-muted/30',
      !isMain && !isOrchestrator && 'bg-card',
    )}>
      {isOrchestrator && (
        <span className="absolute right-3 top-3 rounded px-1.5 py-0.5 text-[10px] bg-foreground/10 text-muted-foreground">
          auto
        </span>
      )}

      {/* Avatar + info */}
      <div className="flex items-center gap-3">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
          isMain ? 'bg-foreground/10' : 'bg-muted',
        )}>
          {isMain
            ? <Crown className="h-4 w-4 text-foreground/70" />
            : <Bot className="h-4 w-4 text-muted-foreground" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{agent.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {agent.model.split('-').slice(1, 3).join(' ')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[agent.status])} />
          <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[agent.status]}</span>
        </div>
      </div>

      {/* System prompt preview */}
      {agent.systemPrompt && (
        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2 italic">
          "{agent.systemPrompt}"
        </p>
      )}

      {/* Task description for orchestrator */}
      {agent.taskDescription && (
        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">
          {agent.taskDescription}
        </p>
      )}

      {/* Actions */}
      {!isMain && (
        <div className="flex justify-end gap-1 border-t pt-2">
          {isOrchestrator ? (
            <Button
              variant="ghost" size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => onStop(agent.id)}
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </Button>
          ) : (
            <>
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(agent)}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(agent.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared dialog form ───────────────────────────────────────────────────────

function AgentDialog({ title, initial, submitLabel, onSubmit, onClose }: {
  title: string
  initial: { name: string; model: string; systemPrompt: string }
  submitLabel: string
  onSubmit: (values: { name: string; model: string; systemPrompt: string }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [model, setModel] = useState(initial.model)
  const [systemPrompt, setSystemPrompt] = useState(initial.systemPrompt)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ name: name.trim(), model, systemPrompt: systemPrompt.trim() })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-semibold">{title}</h2>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Research Assistant"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">System prompt <span className="opacity-50">(optional)</span></Label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Describe what this agent specializes in…"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Onboarding empty state ───────────────────────────────────────────────────

function Onboarding({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2 max-w-xs">
        <h2 className="text-sm font-semibold">Your Agents Office</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Create specialized agents for different tasks — a researcher, a writer, a coder.
          Each agent has its own model and personality, and runs independently alongside Smith.
        </p>
      </div>

      <div className="space-y-2 text-left w-full max-w-xs">
        {[
          { icon: '🔍', text: 'Research Assistant — deep dives on any topic' },
          { icon: '✍️', text: 'Writing Coach — drafts, edits, and polishes text' },
          { icon: '💻', text: 'Code Reviewer — reviews PRs and spots bugs' },
        ].map((hint) => (
          <div key={hint.text} className="flex items-start gap-2.5 text-xs text-muted-foreground">
            <span className="shrink-0">{hint.icon}</span>
            <span>{hint.text}</span>
          </div>
        ))}
      </div>

      <Button size="sm" className="gap-1.5" onClick={onCreateClick}>
        <Plus className="h-3.5 w-3.5" />
        Create your first agent
      </Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentsOffice() {
  const { agents } = useAgentsStore()
  const { config } = useConfigStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentEntry | null>(null)

  const canCreate = config?.multiAgent?.userCreated?.enabled !== false
  const userAgents = agents.filter((a) => a.type === 'user')
  const maxAgents = config?.multiAgent?.userCreated?.maxAgents ?? 10
  const defaultModel = config?.multiAgent?.orchestration?.defaultModel ?? 'claude-haiku-4-5-20251001'

  const showOnboarding = userAgents.length === 0

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    await fetch(`${API}/api/agents/${id}`, { method: 'DELETE' })
  }

  const handleStop = async (id: string) => {
    await fetch(`${API}/api/agents/${id}/stop`, { method: 'POST' })
  }

  const handleCreate = async (values: { name: string; model: string; systemPrompt: string }) => {
    const res = await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, systemPrompt: values.systemPrompt || undefined }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to create agent')
    }
  }

  const handleEdit = async (values: { name: string; model: string; systemPrompt: string }) => {
    if (!editingAgent) return
    const res = await fetch(`${API}/api/agents/${editingAgent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, systemPrompt: values.systemPrompt || undefined }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to update agent')
    }
  }

  // Sort: main first, then user, then orchestrator
  const sorted = [...agents].sort((a, b) => {
    const order = { main: 0, user: 1, orchestrator: 2 }
    return order[a.type] - order[b.type]
  })

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold">Agents Office</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} · {userAgents.length}/{maxAgents} user
          </p>
        </div>
        {canCreate && userAgents.length < maxAgents && !showOnboarding && (
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Agent
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {showOnboarding && canCreate ? (
          <Onboarding onCreateClick={() => setShowCreate(true)} />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
            {sorted.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={setEditingAgent}
                onDelete={handleDelete}
                onStop={handleStop}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      {showCreate && (
        <AgentDialog
          title="New Agent"
          initial={{ name: '', model: defaultModel, systemPrompt: '' }}
          submitLabel="Create"
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit dialog */}
      {editingAgent && (
        <AgentDialog
          title={`Edit — ${editingAgent.name}`}
          initial={{
            name: editingAgent.name,
            model: editingAgent.model,
            systemPrompt: editingAgent.systemPrompt ?? '',
          }}
          submitLabel="Save"
          onSubmit={handleEdit}
          onClose={() => setEditingAgent(null)}
        />
      )}
    </div>
  )
}

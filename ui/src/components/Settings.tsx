import { useState, useEffect, useCallback, useRef } from 'react'
import { useConfigStore } from '@/store/config'
import SkillCard from '@/components/SkillCard'
import ExtensionCard from '@/components/ExtensionCard'
import MemorySection from '@/components/MemorySection'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Section = 'general' | 'security' | 'performance' | 'skills' | 'extensions' | 'system' | 'memory' | 'documents' | 'agents'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'performance', label: 'Performance' },
  { id: 'skills', label: 'Skills' },
  { id: 'extensions', label: 'Extensions' },
  { id: 'system', label: 'System' },
  { id: 'agents', label: 'Agents' },
  { id: 'memory', label: 'Memory / Chat' },
  { id: 'documents', label: 'Documents' },
]

export default function Settings() {
  const [section, setSection] = useState<Section>('general')
  const { config, updateConfig, saveApiKey } = useConfigStore()

  if (!config) return null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar nav */}
      <nav className="w-44 shrink-0 border-r bg-background py-6">
        <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Settings
        </p>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'flex w-full items-center px-4 py-2 text-sm transition-colors',
              section === s.id
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {section === 'general' && <GeneralSection config={config} updateConfig={updateConfig} />}
        {section === 'security' && <SecuritySection config={config} updateConfig={updateConfig} />}
        {section === 'performance' && <PerformanceSection config={config} updateConfig={updateConfig} />}
        {section === 'skills' && <SkillsSection />}
        {section === 'extensions' && <ExtensionsSection />}
        {section === 'system' && <SystemSection config={config} updateConfig={updateConfig} />}
        {section === 'agents' && <AgentsSection config={config} updateConfig={updateConfig} />}
        {section === 'memory' && <MemorySection />}
        {section === 'documents' && <DocumentsSection />}
      </div>
    </div>
  )
}

// ─── General ──────────────────────────────────────────────────────────────────

const PROVIDERS: { id: string; label: string; placeholder: string; models: string[] }[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-…',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-…',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
  },
  {
    id: 'google',
    label: 'Google',
    placeholder: 'AIza…',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    placeholder: 'no key needed',
    models: ['llama3.3', 'mistral', 'qwen2.5', 'phi4'],
  },
]

function detectProviderFromModel(model: string): string {
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('gpt-') || model.startsWith('o3') || model.startsWith('o4')) return 'openai'
  if (model.startsWith('gemini')) return 'google'
  return 'ollama'
}

function GeneralSection({ config, updateConfig }: any) {
  const [agentName, setAgentName] = useState(config.agent.name)
  const [model, setModel] = useState(config.agent.model)
  const [styles, setStyles] = useState<{ name: string; description: string }[]>([])
  const [activeStyle, setActiveStyle] = useState<string>(config.activeStyle ?? 'default')
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [keyErrors, setKeyErrors] = useState<Record<string, string>>({})

  const loadStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/styles')
      const data = await res.json()
      setStyles(data.styles ?? [])
      setActiveStyle(data.active ?? 'default')
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadStyles() }, [loadStyles])

  const handleStyleChange = async (name: string) => {
    setActiveStyle(name)
    await fetch('/api/styles/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  const handleSaveKey = async (providerId: string) => {
    const key = (keys[providerId] ?? '').trim()
    if (!key) return
    setSaving(s => ({ ...s, [providerId]: true }))
    setKeyErrors(e => ({ ...e, [providerId]: '' }))
    try {
      const res = await fetch(`/api/config/apikeys/${providerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
      if (!res.ok) throw new Error('Failed')
      setKeys(k => ({ ...k, [providerId]: '' }))
      setSaved(s => ({ ...s, [providerId]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [providerId]: false })), 2000)
    } catch {
      setKeyErrors(e => ({ ...e, [providerId]: 'Failed to save' }))
    }
    setSaving(s => ({ ...s, [providerId]: false }))
  }

  const handleSaveAgent = async () => {
    await updateConfig({ agent: { ...config.agent, name: agentName, model } })
  }

  const activeProvider = detectProviderFromModel(model)
  const allModels = PROVIDERS.flatMap(p => p.models.map(m => ({ model: m, provider: p.id, label: p.label })))

  return (
    <div className="space-y-6 max-w-md">
      <SectionHeader title="General" />

      <Field label="Agent Name">
        <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} onBlur={handleSaveAgent} />
      </Field>

      <Field label="Model">
        <select
          value={model}
          onChange={(e) => { setModel(e.target.value); updateConfig({ agent: { ...config.agent, model: e.target.value } }) }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {PROVIDERS.map(p => (
            <optgroup key={p.id} label={p.label}>
              {p.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Provider: <span className="font-medium">{PROVIDERS.find(p => p.id === activeProvider)?.label ?? activeProvider}</span>
          {activeProvider === 'anthropic' && ' · prompt caching enabled'}
          {activeProvider === 'openai' && ' · caching automatic'}
          {activeProvider === 'ollama' && ' · local, no caching'}
        </p>
      </Field>

      {styles.length > 0 && (
        <Field label="Response Style">
          <select
            value={activeStyle}
            onChange={(e) => handleStyleChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {styles.map(s => (
              <option key={s.name} value={s.name}>{s.name} — {s.description}</option>
            ))}
          </select>
        </Field>
      )}

      <div className="space-y-1.5">
        <Label className="text-muted-foreground">API Keys</Label>
        <div className="space-y-2">
          {PROVIDERS.filter(p => p.id !== 'ollama').map(p => {
            const isActive = p.id === activeProvider
            const isSet = p.id === 'anthropic'
              ? config.apiKey === '***'
              : config.apiKeys?.[p.id] === '***'
            return (
              <div key={p.id} className={cn(
                'rounded-lg border px-3 py-2.5',
                isActive && 'border-foreground/30 bg-card',
              )}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">{p.label}</span>
                  {isActive && <span className="text-[10px] bg-foreground/10 text-foreground/70 rounded px-1.5 py-0.5">active</span>}
                  {isSet && <span className="text-[10px] text-emerald-500">✓ set</span>}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={keys[p.id] ?? ''}
                    onChange={(e) => setKeys(k => ({ ...k, [p.id]: e.target.value }))}
                    placeholder={isSet ? 'Change key…' : p.placeholder}
                    className="text-xs h-8"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey(p.id) }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 px-3 text-xs shrink-0"
                    onClick={() => handleSaveKey(p.id)}
                    disabled={!keys[p.id]?.trim() || saving[p.id]}
                  >
                    {saved[p.id] ? '✓' : saving[p.id] ? '…' : 'Save'}
                  </Button>
                </div>
                {keyErrors[p.id] && <p className="mt-1 text-xs text-destructive">{keyErrors[p.id]}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Security ─────────────────────────────────────────────────────────────────

function SecuritySection({ config, updateConfig }: any) {
  const privacy = config.privacy ?? {}
  const [showRestartBanner, setShowRestartBanner] = useState(false)

  const update = async (key: string, value: boolean) => {
    await updateConfig({ privacy: { ...privacy, [key]: value } })
  }

  const updateNetwork = async (patch: any) => {
    await updateConfig({ transport: { ...config.transport, ...patch } })
    setShowRestartBanner(true)
  }

  return (
    <div className="space-y-4 max-w-md">
      <SectionHeader title="Security" />

      {showRestartBanner && (
        <div className="rounded-lg border px-4 py-3 text-sm">
          <p className="font-medium">Restart required</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Network settings changed. Restart Agent Smith to apply.
          </p>
          <button onClick={() => setShowRestartBanner(false)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}

      <ToggleRow label="Localhost only" description="Restrict access to this computer only."
        value={config.transport.localhostOnly ?? true} onChange={(v) => updateNetwork({ localhostOnly: v })} />
      <ToggleRow label="Warn before sending files" description="Confirmation before sending file contents."
        value={privacy.warnBeforeSendingFiles ?? true} onChange={(v) => update('warnBeforeSendingFiles', v)} />
      <ToggleRow label="Validate skills on install" description="Warn about potentially dangerous operations."
        value={privacy.validateSkillsOnInstall ?? true} onChange={(v) => update('validateSkillsOnInstall', v)} />
      <ToggleRow label="Local audit log" description="Log all messages sent to the AI provider."
        value={privacy.localAuditLog ?? false} onChange={(v) => update('localAuditLog', v)} />
    </div>
  )
}

// ─── Performance ──────────────────────────────────────────────────────────────

function PerformanceSection({ config, updateConfig }: any) {
  const perf = config.performance ?? {}
  const update = async (key: string, value: any) => {
    await updateConfig({ performance: { ...perf, [key]: value } })
  }

  return (
    <div className="space-y-4 max-w-md">
      <SectionHeader title="Performance" />

      <Field label="History window">
        <select
          value={perf.historyWindow ?? 20}
          onChange={(e) => update('historyWindow', Number(e.target.value))}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value={10}>10 messages</option>
          <option value={20}>20 messages</option>
          <option value={50}>50 messages</option>
        </select>
      </Field>

      <ToggleRow label="Smart compress" description="Automatically summarize old conversation history."
        value={perf.smartCompress ?? true} onChange={(v) => update('smartCompress', v)} />
      <ToggleRow label="Prompt caching" description="Cache system prompt for faster responses."
        value={perf.promptCaching ?? true} onChange={(v) => update('promptCaching', v)} />
    </div>
  )
}

// ─── Skills ───────────────────────────────────────────────────────────────────

function SkillsSection() {
  const [skills, setSkills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSkills = async () => {
    try {
      const data = await fetch('/api/skills').then((r) => r.json())
      setSkills(Array.isArray(data) ? data : [])
    } catch { setSkills([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSkills() }, [])

  return (
    <div className="space-y-3 max-w-md">
      <SectionHeader title="Skills" />
      {loading
        ? <Spinner />
        : skills.length === 0
          ? <p className="text-sm text-muted-foreground">No skills found.</p>
          : skills.map((s) => <SkillCard key={s.name} name={s.name} enabled={s.enabled} config={s.config} description={s.description} onToggled={fetchSkills} />)
      }
    </div>
  )
}

// ─── Extensions ───────────────────────────────────────────────────────────────

function ExtensionsSection() {
  const [extensions, setExtensions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchExtensions = async () => {
    try {
      const data = await fetch('/api/extensions').then((r) => r.json())
      setExtensions(Array.isArray(data) ? data : [])
    } catch { setExtensions([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchExtensions() }, [])

  return (
    <div className="space-y-3 max-w-md">
      <SectionHeader title="Extensions" />
      {loading
        ? <Spinner />
        : extensions.length === 0
          ? <p className="text-sm text-muted-foreground">No extensions loaded.</p>
          : extensions.map((e) => <ExtensionCard key={e.name} name={e.name} enabled={e.enabled} config={e.config} onToggled={fetchExtensions} />)
      }
    </div>
  )
}

// ─── System ───────────────────────────────────────────────────────────────────

function SystemSection({ config, updateConfig }: any) {
  const system = config.system ?? {}
  const heartbeat = config.heartbeat ?? { enabled: false, intervalMinutes: 15 }

  const update = async (key: string, value: any) => {
    await updateConfig({ system: { ...system, [key]: value } })
  }

  const updateHeartbeat = async (patch: Partial<{ enabled: boolean; intervalMinutes: number }>) => {
    await updateConfig({ heartbeat: { ...heartbeat, ...patch } })
  }

  return (
    <div className="space-y-4 max-w-md">
      <SectionHeader title="System" />

      <ToggleRow label="Daily briefing" description="Morning briefing on first open of the day (weather, tasks, reminders)."
        value={system.dailyBriefing ?? true} onChange={(v) => update('dailyBriefing', v)} />
      <ToggleRow label="Prevent sleep" description="Keep computer awake while Smith is running."
        value={system.preventSleep ?? false} onChange={(v) => update('preventSleep', v)} />
      <ToggleRow label="Auto-open browser" description="Automatically open browser when Agent Smith starts."
        value={system.autoOpenBrowser ?? true} onChange={(v) => update('autoOpenBrowser', v)} />
      <ToggleRow label="Dark theme" description="Use dark color scheme."
        value={system.darkTheme ?? true} onChange={(v) => update('darkTheme', v)} />

      <Field label="Language">
        <select
          value={system.language ?? 'en'}
          onChange={(e) => update('language', e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
      </Field>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Heartbeat</p>

      <ToggleRow
        label="Proactive mode"
        description="Agent checks for important events in the background and notifies you automatically."
        value={heartbeat.enabled}
        onChange={(v) => updateHeartbeat({ enabled: v })}
      />

      {heartbeat.enabled && (
        <Field label="Check interval">
          <select
            value={heartbeat.intervalMinutes}
            onChange={(e) => updateHeartbeat({ intervalMinutes: Number(e.target.value) })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={5}>Every 5 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every hour</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Agent will silently check for upcoming events, tasks, and reminders.
          </p>
        </Field>
      )}
    </div>
  )
}

// ─── Primitives ────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="space-y-3 pb-1">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <Separator />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-lg border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} className="shrink-0" />
    </div>
  )
}

// ─── Documents ────────────────────────────────────────────────────────────────

const API = import.meta.env.DEV ? 'http://localhost:3000' : ''

interface DocEntry {
  source_url: string
  name: string
  chunks: number
  indexed: string
}

function DocumentsSection() {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/documents`)
      if (res.ok) setDocs(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setWorking('upload')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API}/api/documents/upload`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Upload failed')
      }
      await loadDocs()
    } catch (err: any) {
      setUploadError(err?.message ?? 'Upload failed')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    setWorking(null)
  }

  const handleDelete = async (doc: DocEntry) => {
    if (!confirm(`Remove "${doc.name}" and delete all its indexed content?`)) return
    setWorking(doc.source_url)
    try {
      await fetch(`${API}/api/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: doc.source_url }),
      })
      await loadDocs()
    } catch { /* ignore */ }
    setWorking(null)
  }

  const handleReindex = async (doc: DocEntry) => {
    setWorking(doc.source_url + '-reindex')
    try {
      const res = await fetch(`${API}/api/documents/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: doc.source_url }),
      })
      if (!res.ok) throw new Error('Reindex failed')
      await loadDocs()
    } catch { /* ignore */ }
    setWorking(null)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Documents</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Files indexed into LIMA memory for agent recall
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={working === 'upload'}>
            {working === 'upload' ? 'Uploading…' : '+ Upload'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadDocs}>
            Refresh
          </Button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={handleUpload} />

      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

      {loading ? (
        <Spinner />
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          No documents indexed yet.<br />
          <span className="text-xs">Upload a PDF, DOCX, TXT or MD file to let the agent search it.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.source_url} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.chunks} chunks · indexed {new Date(doc.indexed).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => handleReindex(doc)}
                  disabled={working === doc.source_url + '-reindex'}
                >
                  {working === doc.source_url + '-reindex' ? 'Re-indexing…' : 'Reindex'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(doc)}
                  disabled={working === doc.source_url}
                >
                  {working === doc.source_url ? '…' : 'Delete'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Agents ───────────────────────────────────────────────────────────────────

const AGENT_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast, cheap)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
]

function AgentsSection({ config, updateConfig }: any) {
  const uc = config.multiAgent?.userCreated ?? { enabled: true, maxAgents: 10, persistAgents: true }
  const orch = config.multiAgent?.orchestration ?? { enabled: false, maxConcurrent: 3, defaultModel: 'claude-haiku-4-5-20251001', autoDestroy: true }

  const updateUC = async (patch: any) => {
    await updateConfig({ multiAgent: { ...config.multiAgent, userCreated: { ...uc, ...patch } } })
  }
  const updateOrch = async (patch: any) => {
    await updateConfig({ multiAgent: { ...config.multiAgent, orchestration: { ...orch, ...patch } } })
  }

  return (
    <div className="space-y-4 max-w-md">
      <SectionHeader title="Agents" />

      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">User Agents</p>

      <ToggleRow
        label="Allow creating user agents"
        description="Let users create persistent custom agents in Agents Office."
        value={uc.enabled ?? true}
        onChange={(v) => updateUC({ enabled: v })}
      />

      <Field label="Max user agents">
        <select
          value={uc.maxAgents ?? 10}
          onChange={(e) => updateUC({ maxAgents: Number(e.target.value) })}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {[3, 5, 10, 20].map((n) => (
            <option key={n} value={n}>{n} agents</option>
          ))}
        </select>
      </Field>

      <Separator />
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Orchestration</p>

      <ToggleRow
        label="Allow orchestration"
        description="Let the main agent spawn sub-agents automatically to handle complex tasks. Off by default."
        value={orch.enabled ?? false}
        onChange={(v) => updateOrch({ enabled: v })}
      />

      {orch.enabled && (
        <>
          <Field label="Max concurrent orchestrator agents">
            <select
              value={orch.maxConcurrent ?? 3}
              onChange={(e) => updateOrch({ maxConcurrent: Number(e.target.value) })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Hard limit — prevents runaway token spend.</p>
          </Field>

          <Field label="Default sub-agent model">
            <select
              value={orch.defaultModel ?? 'claude-haiku-4-5-20251001'}
              onChange={(e) => updateOrch({ defaultModel: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {AGENT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>

          <ToggleRow
            label="Auto-destroy after task"
            description="Remove orchestrator agents from the registry once their task completes."
            value={orch.autoDestroy ?? true}
            onChange={(v) => updateOrch({ autoDestroy: v })}
          />
        </>
      )}
    </div>
  )
}

function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
}

import { useState, useEffect, useCallback } from 'react'
import { useConfigStore } from '@/store/config'
import SkillCard from '@/components/SkillCard'
import ExtensionCard from '@/components/ExtensionCard'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Section = 'general' | 'security' | 'performance' | 'skills' | 'extensions' | 'system'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'performance', label: 'Performance' },
  { id: 'skills', label: 'Skills' },
  { id: 'extensions', label: 'Extensions' },
  { id: 'system', label: 'System' },
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
        {section === 'general' && <GeneralSection config={config} saveApiKey={saveApiKey} updateConfig={updateConfig} />}
        {section === 'security' && <SecuritySection config={config} updateConfig={updateConfig} />}
        {section === 'performance' && <PerformanceSection config={config} updateConfig={updateConfig} />}
        {section === 'skills' && <SkillsSection />}
        {section === 'extensions' && <ExtensionsSection />}
        {section === 'system' && <SystemSection config={config} updateConfig={updateConfig} />}
      </div>
    </div>
  )
}

// ─── General ──────────────────────────────────────────────────────────────────

function GeneralSection({ config, saveApiKey, updateConfig }: any) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [agentName, setAgentName] = useState(config.agent.name)
  const [model, setModel] = useState(config.agent.model)
  const [saving, setSaving] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [styles, setStyles] = useState<{ name: string; description: string }[]>([])
  const [activeStyle, setActiveStyle] = useState<string>(config.activeStyle ?? 'default')

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

  const handleSaveApiKey = async () => {
    const trimmed = apiKey.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('sk-ant-')) {
      setKeyError('Invalid key format. Anthropic keys start with "sk-ant-".')
      return
    }
    setKeyError(null)
    setSaving(true)
    await saveApiKey(trimmed)
    setApiKey('')
    setSaving(false)
  }

  const handleSaveAgent = async () => {
    await updateConfig({ agent: { ...config.agent, name: agentName, model } })
  }

  return (
    <div className="space-y-6 max-w-md">
      <SectionHeader title="General" />

      <Field label="Agent Name">
        <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} onBlur={handleSaveAgent} />
      </Field>

      <Field label="Model">
        <select
          value={model}
          onChange={(e) => { setModel(e.target.value); handleSaveAgent() }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
          <option value="claude-opus-4-6">claude-opus-4-6</option>
          <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001</option>
        </select>
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

      <Field label="API Key">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config.apiKey === '***' ? 'Change API key…' : 'Enter API key…'}
              className="pr-14"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleSaveApiKey} disabled={!apiKey.trim() || saving}>
            Save
          </Button>
        </div>
        {keyError && <p className="mt-1.5 text-xs text-destructive">{keyError}</p>}
        {config.apiKey === '***' && !keyError && (
          <p className="mt-1.5 text-xs text-foreground/50">✓ API key is set</p>
        )}
      </Field>
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
  const update = async (key: string, value: any) => {
    await updateConfig({ system: { ...system, [key]: value } })
  }

  return (
    <div className="space-y-4 max-w-md">
      <SectionHeader title="System" />

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

function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
}

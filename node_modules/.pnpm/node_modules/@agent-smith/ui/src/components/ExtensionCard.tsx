import { useState } from 'react'
import { useConfigStore } from '@/store/config'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Config field descriptors per extension name
const EXTENSION_CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder?: string; type?: string; hint?: string }[]> = {
  browser: [
    { key: 'tavilyApiKey', label: 'Tavily API Key', placeholder: 'tvly-...', type: 'password', hint: 'Free at app.tavily.com (1000 searches/month)' },
  ],
  email: [
    { key: 'host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'Port', placeholder: '587' },
    { key: 'user', label: 'Email Address', placeholder: 'you@gmail.com' },
    { key: 'password', label: 'App Password', placeholder: '••••••••', type: 'password' },
    { key: 'from', label: 'From Name/Address', placeholder: 'Your Name <you@gmail.com>' },
  ],
}

interface ExtensionCardProps {
  name: string
  enabled: boolean
  config?: Record<string, string>
  onToggled?: () => void
}

export default function ExtensionCard({ name, enabled, config = {}, onToggled }: ExtensionCardProps) {
  const { toggleExtension } = useConfigStore()
  const fields = EXTENSION_CONFIG_FIELDS[name]
  const [expanded, setExpanded] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(config)
  const [saving, setSaving] = useState(false)

  const handleToggle = async (checked: boolean) => {
    await toggleExtension(name, checked)
    onToggled?.()
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await fetch(`/api/extensions/${name}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      // Enable the extension automatically after saving config
      if (!enabled) {
        await toggleExtension(name, true)
        onToggled?.()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors">
        <div className="flex items-center gap-3">
          <div className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-foreground' : 'bg-muted-foreground/30')} />
          <div>
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">Extension</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fields && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              {expanded ? 'Hide' : 'Configure'}
            </button>
          )}
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {fields && expanded && (
        <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
          <div className="pt-3 space-y-2">
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                {f.hint && <p className="text-xs text-muted-foreground/60">{f.hint}</p>}
                <Input
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <Button size="sm" onClick={handleSaveConfig} disabled={saving} className="w-full">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useConfigStore } from '@/store/config'
import SmithAvatar from '@/components/SmithAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Provider = 'anthropic' | 'openai' | 'google' | 'ollama'

const PROVIDERS: {
  id: Provider
  name: string
  docsUrl: string
  privacy: string
  local: boolean
}[] = [
  { id: 'anthropic', name: 'Anthropic', docsUrl: 'https://console.anthropic.com', privacy: "Conversations are sent to Anthropic's servers.", local: false },
  { id: 'openai', name: 'OpenAI', docsUrl: 'https://platform.openai.com', privacy: "Conversations are sent to OpenAI's servers.", local: false },
  { id: 'google', name: 'Google', docsUrl: 'https://aistudio.google.com', privacy: "Conversations are sent to Google's servers.", local: false },
  { id: 'ollama', name: 'Ollama', docsUrl: 'https://ollama.com', privacy: 'Everything runs locally. Nothing is sent externally.', local: true },
]

export default function Onboarding() {
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { saveApiKey } = useConfigStore()
  const selected = PROVIDERS.find((p) => p.id === provider)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim() && provider !== 'ollama') {
      setError('API key is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveApiKey(provider === 'ollama' ? 'ollama' : apiKey.trim())
    } catch {
      setError('Failed to save. Make sure the backend is running.')
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="mx-auto flex items-center justify-center">
            <SmithAvatar agentState="idle" size={180} />
          </div>
          <p className="text-sm text-muted-foreground">Your personal AI agent.</p>
        </div>

        <Separator />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider selection */}
          <div className="space-y-2">
            <Label>AI Provider</Label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors text-left',
                    provider === p.id
                      ? 'border-foreground bg-secondary text-foreground font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span>{p.name}</span>
                  {p.local && (
                    <span className="text-[10px] text-green-600 dark:text-green-500 font-normal">local</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy notice */}
          <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/40 px-3 py-2">
            {selected.privacy}
          </p>

          {/* API Key */}
          {provider !== 'ollama' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>API Key</Label>
                <a
                  href={selected.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Get key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-…"
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Saving…' : 'Get Started →'}
          </Button>
        </form>
      </div>
    </div>
  )
}

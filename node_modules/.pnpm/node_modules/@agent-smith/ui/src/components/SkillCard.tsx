import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { useConfigStore } from '@/store/config'
import SkillSettings from '@/components/SkillSettings'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SkillCardProps {
  name: string
  enabled: boolean
  config?: Record<string, any>
  description?: string
  onToggled?: () => void
}

export default function SkillCard({ name, enabled, config, description, onToggled }: SkillCardProps) {
  const { toggleSkill } = useConfigStore()
  const [showSettings, setShowSettings] = useState(false)
  const hasConfig = config && Object.keys(config).length > 0

  const handleToggle = async (checked: boolean) => {
    await toggleSkill(name, checked)
    onToggled?.()
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-accent transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', enabled ? 'bg-foreground' : 'bg-muted-foreground/30')} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{name}</p>
            {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {hasConfig && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(true)}>
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {showSettings && hasConfig && (
        <SkillSettings name={name} config={config!} onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}

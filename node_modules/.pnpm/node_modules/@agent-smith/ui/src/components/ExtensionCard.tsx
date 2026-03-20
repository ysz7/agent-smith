import { useConfigStore } from '@/store/config'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface ExtensionCardProps {
  name: string
  enabled: boolean
  onToggled?: () => void
}

export default function ExtensionCard({ name, enabled, onToggled }: ExtensionCardProps) {
  const { toggleExtension } = useConfigStore()

  const handleToggle = async (checked: boolean) => {
    await toggleExtension(name, checked)
    onToggled?.()
  }

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-accent transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-foreground' : 'bg-muted-foreground/30')} />
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">Extension</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} />
    </div>
  )
}

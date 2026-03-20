import { useState } from 'react'
import { useConfigStore } from '@/store/config'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SkillSettingsProps {
  name: string
  config: Record<string, any>
  onClose: () => void
}

export default function SkillSettings({ name, config, onClose }: SkillSettingsProps) {
  const { updateConfig } = useConfigStore()
  const [values, setValues] = useState<Record<string, any>>(config)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateConfig({ skills: { [name]: { enabled: true, config: values } } } as any)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{name} — Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {Object.entries(values).map(([key, value]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Label>
              {typeof value === 'boolean' ? (
                <Switch checked={value} onCheckedChange={(checked) => setValues((v) => ({ ...v, [key]: checked }))} />
              ) : typeof value === 'number' ? (
                <Input type="number" value={value} onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))} />
              ) : (
                <Input type="text" value={String(value)} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

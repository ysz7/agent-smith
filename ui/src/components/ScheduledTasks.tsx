import { useEffect, useState } from 'react'
import { Play, Trash2, Clock } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ScheduledTask {
  id: string
  name: string
  cron: string
  enabled: boolean
  instructions: string
  lastRun?: string
  lastStatus?: 'success' | 'error'
}

export default function ScheduledTasks() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = async () => {
    try {
      const data = await fetch('/api/tasks').then((r) => r.json())
      setTasks(Array.isArray(data) ? data : [])
    } catch { setTasks([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTasks() }, [])

  const handleToggle = async (task: ScheduledTask, checked: boolean) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: checked }),
    })
    fetchTasks()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    fetchTasks()
  }

  const handleRunNow = (task: ScheduledTask) => {
    alert(`Task "${task.name}" will run at its next scheduled time.\n\nCron: ${task.cron}`)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mb-6 max-w-2xl">
        <h2 className="text-base font-semibold text-foreground">Scheduled Tasks</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tasks that run automatically on a schedule.</p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No scheduled tasks yet</p>
          <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
            Ask Smith to create one:{' '}
            <span className="italic">"Every day at 9am check the news and summarize it"</span>
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start justify-between rounded-lg border px-4 py-3 gap-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', task.enabled ? 'bg-foreground' : 'bg-muted-foreground/30')} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.name}</p>
                  <code className="text-xs text-muted-foreground">{task.cron}</code>
                  {task.lastRun && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant={task.lastStatus === 'success' ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 py-0">
                        {task.lastStatus}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.lastRun).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRunNow(task)}>
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Switch checked={task.enabled} onCheckedChange={(checked) => handleToggle(task, checked)} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(task.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

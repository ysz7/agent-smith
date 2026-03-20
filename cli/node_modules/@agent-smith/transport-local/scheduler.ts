import * as cron from 'node-cron'
import type { IScheduler, ScheduledJob } from '@agent-smith/core'

export class LocalScheduler implements IScheduler {
  private jobs = new Map<string, { task: cron.ScheduledTask; job: ScheduledJob }>()

  schedule(id: string, cronExpr: string, fn: () => void): void {
    this.cancel(id)

    const task = cron.schedule(cronExpr, () => {
      const entry = this.jobs.get(id)
      if (!entry) return

      entry.job.lastRun = new Date()
      try {
        fn()
        entry.job.lastStatus = 'success'
      } catch {
        entry.job.lastStatus = 'error'
      }
    })

    this.jobs.set(id, {
      task,
      job: { id, cron: cronExpr, enabled: true },
    })
  }

  cancel(id: string): void {
    const entry = this.jobs.get(id)
    if (entry) {
      entry.task.stop()
      this.jobs.delete(id)
    }
  }

  list(): ScheduledJob[] {
    return Array.from(this.jobs.values()).map(e => ({ ...e.job }))
  }
}

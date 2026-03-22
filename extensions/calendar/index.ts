import { randomUUID } from 'crypto'
import type { ExtensionAPI } from '@agent-smith/core'

const PREFIX = 'calendar:event:'

export interface CalendarEvent {
  id: string
  title: string
  datetime: string   // ISO 8601
  duration: number   // minutes
  description?: string
  taskId?: string    // linked scheduled task id (for the reminder)
  created: string    // ISO 8601
}

function parseDate(iso: string): Date | null {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

/** Convert a datetime to a cron expression that fires once at that exact moment */
function datetimeToCron(dt: Date): string {
  return `${dt.getMinutes()} ${dt.getHours()} ${dt.getDate()} ${dt.getMonth() + 1} *`
}

/** Check overlap: two events conflict if they share any minute */
function conflicts(a: CalendarEvent, b: CalendarEvent): boolean {
  const aStart = new Date(a.datetime).getTime()
  const aEnd   = aStart + a.duration * 60000
  const bStart = new Date(b.datetime).getTime()
  const bEnd   = bStart + b.duration * 60000
  return aStart < bEnd && bStart < aEnd
}

export default function register(api: ExtensionAPI): void {

  // ── calendar_add ────────────────────────────────────────────────────────────

  api.registerTool({
    name: 'calendar_add',
    description: 'Save a calendar event. Returns the event id, a cron expression for the reminder task, and any conflicting events.',
    parameters: {
      properties: {
        title:       { type: 'string',  description: 'Event title (e.g. "Team meeting", "Doctor appointment")' },
        datetime:    { type: 'string',  description: 'Event start time as ISO 8601 string (e.g. "2026-03-24T15:00:00")' },
        duration:    { type: 'number',  description: 'Duration in minutes (default: 60)' },
        description: { type: 'string',  description: 'Optional notes or agenda' },
        taskId:      { type: 'string',  description: 'ID of the linked scheduled reminder task (set after calling task_create)' },
      },
      required: ['title', 'datetime'],
    },
    run: async ({ title, datetime, duration = 60, description, taskId }: {
      title: string; datetime: string; duration?: number; description?: string; taskId?: string
    }) => {
      const dt = parseDate(datetime)
      if (!dt) return { error: `Invalid datetime: "${datetime}". Use ISO 8601 format.` }

      // Load existing events to check conflicts
      const keys = await api.storage.list(PREFIX)
      const existing: CalendarEvent[] = []
      for (const key of keys) {
        const ev = await api.storage.get(key)
        if (ev) existing.push(ev)
      }

      const newEvent: CalendarEvent = {
        id: randomUUID(),
        title,
        datetime: dt.toISOString(),
        duration,
        description,
        taskId,
        created: new Date().toISOString(),
      }

      // Detect conflicts with future events only
      const now = Date.now()
      const conflicting = existing.filter(ev =>
        new Date(ev.datetime).getTime() > now && conflicts(newEvent, ev)
      )

      await api.storage.set(`${PREFIX}${newEvent.id}`, newEvent)

      return {
        id: newEvent.id,
        saved: true,
        cron: datetimeToCron(dt),
        conflicts: conflicting.length > 0
          ? conflicting.map(ev => ({ id: ev.id, title: ev.title, datetime: ev.datetime, duration: ev.duration }))
          : [],
      }
    },
  })

  // ── calendar_list ───────────────────────────────────────────────────────────

  api.registerTool({
    name: 'calendar_list',
    description: 'List calendar events. Optionally filter by date range.',
    parameters: {
      properties: {
        from: { type: 'string', description: 'Start of range ISO 8601 (default: now)' },
        to:   { type: 'string', description: 'End of range ISO 8601 (default: 30 days from now)' },
        includePast: { type: 'boolean', description: 'Include past events (default: false)' },
      },
      required: [],
    },
    run: async ({ from, to, includePast = false }: { from?: string; to?: string; includePast?: boolean }) => {
      const fromTs = from ? new Date(from).getTime() : (includePast ? 0 : Date.now())
      const toTs   = to   ? new Date(to).getTime()   : Date.now() + 30 * 24 * 60 * 60 * 1000

      const keys = await api.storage.list(PREFIX)
      const events: CalendarEvent[] = []
      for (const key of keys) {
        const ev = await api.storage.get(key)
        if (!ev) continue
        const ts = new Date(ev.datetime).getTime()
        if (ts >= fromTs && ts <= toTs) events.push(ev)
      }

      events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())

      if (events.length === 0) return { count: 0, events: [] }

      return {
        count: events.length,
        events: events.map(ev => ({
          id: ev.id,
          title: ev.title,
          datetime: ev.datetime,
          duration: ev.duration,
          description: ev.description ?? null,
        })),
      }
    },
  })

  // ── calendar_delete ─────────────────────────────────────────────────────────

  api.registerTool({
    name: 'calendar_delete',
    description: 'Delete a calendar event by id. Returns the taskId of the linked reminder so you can also call task_delete.',
    parameters: {
      properties: {
        id: { type: 'string', description: 'Event id to delete' },
      },
      required: ['id'],
    },
    run: async ({ id }: { id: string }) => {
      const ev: CalendarEvent | null = await api.storage.get(`${PREFIX}${id}`)
      if (!ev) return { error: `Event "${id}" not found` }
      await api.storage.delete(`${PREFIX}${id}`)
      return { deleted: true, id, taskId: ev.taskId ?? null }
    },
  })

  // ── calendar_update ─────────────────────────────────────────────────────────

  api.registerTool({
    name: 'calendar_update',
    description: 'Update an existing calendar event (reschedule or edit). Returns new cron expression if datetime changed.',
    parameters: {
      properties: {
        id:          { type: 'string',  description: 'Event id to update' },
        title:       { type: 'string',  description: 'New title (optional)' },
        datetime:    { type: 'string',  description: 'New datetime ISO 8601 (optional)' },
        duration:    { type: 'number',  description: 'New duration in minutes (optional)' },
        description: { type: 'string',  description: 'New description (optional)' },
        taskId:      { type: 'string',  description: 'Updated linked task id (optional)' },
      },
      required: ['id'],
    },
    run: async ({ id, title, datetime, duration, description, taskId }: {
      id: string; title?: string; datetime?: string; duration?: number; description?: string; taskId?: string
    }) => {
      const ev: CalendarEvent | null = await api.storage.get(`${PREFIX}${id}`)
      if (!ev) return { error: `Event "${id}" not found` }

      let newCron: string | null = null
      if (datetime) {
        const dt = parseDate(datetime)
        if (!dt) return { error: `Invalid datetime: "${datetime}"` }
        ev.datetime = dt.toISOString()
        newCron = datetimeToCron(dt)
      }
      if (title !== undefined)       ev.title       = title
      if (duration !== undefined)    ev.duration    = duration
      if (description !== undefined) ev.description = description
      if (taskId !== undefined)      ev.taskId      = taskId

      await api.storage.set(`${PREFIX}${id}`, ev)
      return { updated: true, id, ...(newCron ? { newCron } : {}) }
    },
  })
}

import { EventEmitter } from 'events'
import type { AgentRegistryEntry, AgentStatus } from './interfaces'

/**
 * In-memory registry of all live agents (main + user + orchestrator).
 * Emits 'change' with a serializable snapshot on every mutation.
 * User agents are persisted in config; orchestrator agents are ephemeral.
 */
export class AgentRegistry extends EventEmitter {
  private agents: Map<string, AgentRegistryEntry> = new Map()

  register(entry: AgentRegistryEntry): void {
    this.agents.set(entry.id, entry)
    this.emit('change', this.snapshot())
  }

  unregister(id: string): void {
    this.agents.delete(id)
    this.emit('change', this.snapshot())
  }

  setStatus(id: string, status: AgentStatus): void {
    const entry = this.agents.get(id)
    if (!entry) return
    entry.status = status
    this.emit('change', this.snapshot())
  }

  /** Stop and remove an agent. Main agent cannot be stopped. Returns false if not found or protected. */
  stop(id: string): boolean {
    const entry = this.agents.get(id)
    if (!entry || entry.type === 'main') return false
    entry.abort?.()
    if (entry.type === 'orchestrator') {
      // Orchestrator agents are destroyed on stop
      this.agents.delete(id)
    } else {
      entry.status = 'stopped'
    }
    this.emit('change', this.snapshot())
    return true
  }

  get(id: string): AgentRegistryEntry | undefined {
    return this.agents.get(id)
  }

  list(): AgentRegistryEntry[] {
    return Array.from(this.agents.values())
  }

  /** Serializable snapshot — strips the non-transferable abort function */
  snapshot(): Omit<AgentRegistryEntry, 'abort'>[] {
    return this.list().map(({ abort: _a, ...rest }) => rest)
  }
}

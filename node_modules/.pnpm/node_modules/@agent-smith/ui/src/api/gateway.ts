import { useChatStore } from '../store/chat'
import { useConfigStore } from '../store/config'
import { useAgentsStore } from '../store/agents'

class GatewayClient {
  private ws: WebSocket | null = null
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private reconnectDelay = 1000
  private historyLoaded = false
  private activeAgentId: string | null = null  // tracks which agent is currently streaming

  connect(): void {
    // In dev, Vite runs on 5173 but backend WS is on 3000
    // In prod, served from the same Express server
    const host = import.meta.env.DEV ? 'localhost:3000' : window.location.host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${host}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectDelay = 1000
      useChatStore.getState().setConnected(true)
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this.handleMessage(msg)
      } catch {
        // Ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      useChatStore.getState().setConnected(false)
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  send(content: string, image?: { data: string; mediaType: string }): void {
    this.activeAgentId = null
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', content, ...(image && { image }) }))
    }
  }

  sendToAgent(agentId: string, content: string): void {
    this.activeAgentId = agentId
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', content, agentId }))
    }
  }

  stop(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop' }))
    }
  }

  async loadAgentHistory(agentId: string): Promise<void> {
    try {
      const backendHost = import.meta.env.DEV ? 'http://localhost:3000' : ''
      const res = await fetch(`${backendHost}/api/history?agentId=${encodeURIComponent(agentId)}`)
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) return
      const messages = data.map((m: any) => ({
        id: m.id ?? Math.random().toString(36).slice(2),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.timestamp),
      }))
      useChatStore.getState().setAgentHistory(agentId, messages)
    } catch {
      // Non-fatal
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }

  private async handleMessage(msg: any): Promise<void> {
    const chat = useChatStore.getState()

    switch (msg.type) {
      case 'connected':
        // Reload config and load chat history once after first connect
        useConfigStore.getState().fetchConfig()
        if (!this.historyLoaded) {
          this.historyLoaded = true
          await this.loadHistory()
        }
        break

      case 'stream_start':
        if (this.activeAgentId) {
          chat.startAgentStreaming(this.activeAgentId)
        } else {
          chat.startStreaming()
        }
        break

      case 'chunk':
        if (this.activeAgentId) {
          chat.appendAgentChunk(this.activeAgentId, msg.content ?? '')
        } else {
          chat.appendChunk(msg.content ?? '')
        }
        break

      case 'stream_end':
        if (this.activeAgentId) {
          chat.endAgentStreaming(this.activeAgentId)
        } else {
          chat.endStreaming()
        }
        break

      case 'status':
        chat.setStatus(msg.content ?? null)
        break

      case 'message':
        // Used for scheduled task broadcasts and proactive heartbeat (non-streaming)
        chat.addMessage({
          id: Math.random().toString(36).slice(2),
          role: 'assistant',
          content: msg.content ?? '',
          timestamp: new Date(),
          isError: false,
          isProactive: msg.data?.proactive === true,
        })
        break

      case 'agent_status':
        useAgentsStore.getState().setAgents(msg.agents ?? [])
        break

      case 'error': {
        const agentId = this.activeAgentId
        if (agentId) {
          chat.endAgentStreaming(agentId)
          chat.addAgentMessage(agentId, {
            id: Math.random().toString(36).slice(2),
            role: 'assistant',
            content: msg.content ?? 'An error occurred.',
            timestamp: new Date(),
            isError: true,
          })
        } else {
          if (chat.streamingContent !== null) chat.endStreaming()
          chat.addMessage({
            id: Math.random().toString(36).slice(2),
            role: 'assistant',
            content: msg.content ?? 'An error occurred.',
            timestamp: new Date(),
            isError: true,
          })
        }
        break
      }
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const backendHost = import.meta.env.DEV ? 'http://localhost:3000' : ''
      const res = await fetch(`${backendHost}/api/history`)
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) return

      const messages = data.map((m: any) => ({
        id: m.id ?? Math.random().toString(36).slice(2),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.timestamp),
      }))

      useChatStore.getState().setHistory(messages)
    } catch {
      // History load failure is non-fatal
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000)
      this.connect()
    }, this.reconnectDelay)
  }
}

export const gateway = new GatewayClient()

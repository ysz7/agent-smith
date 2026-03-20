import { useChatStore } from '../store/chat'
import { useConfigStore } from '../store/config'

class GatewayClient {
  private ws: WebSocket | null = null
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private reconnectDelay = 1000
  private historyLoaded = false

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

  send(content: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', content }))
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
        chat.startStreaming()
        break

      case 'chunk':
        chat.appendChunk(msg.content ?? '')
        break

      case 'stream_end':
        chat.endStreaming()
        break

      case 'status':
        chat.setStatus(msg.content ?? null)
        break

      case 'message':
        // Used for scheduled task broadcasts (non-streaming)
        chat.addMessage({
          id: Math.random().toString(36).slice(2),
          role: 'assistant',
          content: msg.content ?? '',
          timestamp: new Date(),
          isError: false,
        })
        break

      case 'error':
        // Make sure we close any open stream first
        if (chat.streamingContent !== null) {
          chat.endStreaming()
        }
        chat.addMessage({
          id: Math.random().toString(36).slice(2),
          role: 'assistant',
          content: msg.content ?? 'An error occurred.',
          timestamp: new Date(),
          isError: true,
        })
        break
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

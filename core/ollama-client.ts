import { Ollama } from 'ollama'

export type OllamaMessage = {
  role: string
  content: string
  images?: string[]
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
}

export type OllamaToolDef = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

function supportsThinking(model: string): boolean {
  return model.startsWith('qwen3') || model.startsWith('qwq')
}

// Strips <think>...</think> blocks from streaming content.
// Stateful — handles tags that span multiple chunks.
class ThinkStripper {
  private buffer = ''
  private inThink = false

  process(chunk: string): string {
    this.buffer += chunk
    let output = ''

    while (this.buffer.length > 0) {
      if (this.inThink) {
        const closeIdx = this.buffer.indexOf('</think>')
        if (closeIdx === -1) {
          this.buffer = ''
          break
        }
        this.buffer = this.buffer.slice(closeIdx + '</think>'.length)
        this.inThink = false
      } else {
        const openIdx = this.buffer.indexOf('<think>')
        if (openIdx === -1) {
          // Check if buffer ends with a partial opening tag
          const partial = this.partialTagLength(this.buffer, '<think>')
          if (partial > 0) {
            output += this.buffer.slice(0, this.buffer.length - partial)
            this.buffer = this.buffer.slice(this.buffer.length - partial)
            break
          }
          output += this.buffer
          this.buffer = ''
          break
        }
        output += this.buffer.slice(0, openIdx)
        this.buffer = this.buffer.slice(openIdx + '<think>'.length)
        this.inThink = true
      }
    }

    return output
  }

  flush(): string {
    if (!this.inThink && this.buffer) {
      const result = this.buffer
      this.buffer = ''
      return result
    }
    this.buffer = ''
    return ''
  }

  private partialTagLength(text: string, tag: string): number {
    for (let i = tag.length - 1; i >= 1; i--) {
      if (text.endsWith(tag.slice(0, i))) return i
    }
    return 0
  }
}

function injectThinkDirective(messages: any[], think: boolean): any[] {
  if (!think) {
    // Prepend /no_think to first user message to reliably disable thinking mode
    return messages.map((m, i) => {
      if (i === 0 && m.role === 'user' && typeof m.content === 'string') {
        return { ...m, content: `/no_think ${m.content}` }
      }
      return m
    })
  }
  return messages
}

export class OllamaClient {
  private ollama: Ollama
  private think: boolean

  constructor(host = 'http://localhost:11434', think = false) {
    this.ollama = new Ollama({ host })
    this.think = think
  }

  async stream(
    model: string,
    systemPrompt: string,
    messages: OllamaMessage[],
    tools: OllamaToolDef[],
    onChunk: (text: string) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<{ text: string; toolCalls: OllamaMessage['tool_calls'] }> {
    const baseMessages = [{ role: 'system', content: systemPrompt }, ...messages]
    const allMessages = supportsThinking(model)
      ? injectThinkDirective(baseMessages, this.think)
      : baseMessages
    const thinkParam = supportsThinking(model) ? { think: this.think } : {}
    let useTools = tools.length > 0
    let chatStream: any

    try {
      chatStream = await this.ollama.chat({
        model,
        messages: allMessages as any,
        stream: true,
        ...thinkParam,
        ...(useTools ? { tools: tools as any } : {}),
      })
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() ?? ''
      if (useTools && (errMsg.includes('tool') || errMsg.includes('function') || errMsg.includes('support'))) {
        useTools = false
        chatStream = await this.ollama.chat({
          model,
          messages: allMessages as any,
          stream: true,
          ...thinkParam,
        })
      } else {
        throw err
      }
    }

    let text = ''
    let toolCalls: OllamaMessage['tool_calls']
    const stripper = new ThinkStripper()

    try {
      for await (const part of chatStream) {
        if (signal?.aborted) break
        if (part.message.content) {
          text += part.message.content
          const visible = stripper.process(part.message.content)
          if (visible) await onChunk(visible)
        }
        // Collect tool_calls from any chunk — some models emit them before done=true
        if ((part.message as any).tool_calls?.length) {
          toolCalls = (part.message as any).tool_calls
        }
      }
      const tail = stripper.flush()
      if (tail) await onChunk(tail)
    } catch (streamErr: any) {
      // Some models throw tool-related errors during streaming (not during initial chat())
      const msg = streamErr?.message?.toLowerCase() ?? ''
      if (useTools && (msg.includes('tool') || msg.includes('function'))) {
        // Retry without tools — caller will get text-only response
        text = ''
        const fallbackStream = await this.ollama.chat({
          model,
          messages: allMessages as any,
          stream: true,
        })
        const fallbackStripper = new ThinkStripper()
        for await (const part of fallbackStream) {
          if (signal?.aborted) break
          if (part.message.content) {
            text += part.message.content
            const visible = fallbackStripper.process(part.message.content)
            if (visible) await onChunk(visible)
          }
        }
        const tail2 = fallbackStripper.flush()
        if (tail2) await onChunk(tail2)
      } else {
        throw streamErr
      }
    }

    return { text, toolCalls }
  }

  async complete(
    model: string,
    systemPrompt: string,
    messages: OllamaMessage[],
    tools: OllamaToolDef[],
  ): Promise<{ text: string; toolCalls: OllamaMessage['tool_calls'] }> {
    const baseMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages
    const allMessages = supportsThinking(model)
      ? injectThinkDirective(baseMessages, this.think)
      : baseMessages

    const thinkParam = supportsThinking(model) ? { think: this.think } : {}
    let response: any

    try {
      response = await this.ollama.chat({
        model,
        messages: allMessages as any,
        stream: false,
        ...thinkParam,
        ...(tools.length > 0 ? { tools: tools as any } : {}),
      })
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() ?? ''
      if (tools.length > 0 && (errMsg.includes('tool') || errMsg.includes('function') || errMsg.includes('support'))) {
        response = await this.ollama.chat({
          model,
          messages: allMessages as any,
          stream: false,
          ...thinkParam,
        })
      } else {
        throw err
      }
    }

    return {
      text: response.message.content ?? '',
      toolCalls: (response.message as any).tool_calls as OllamaMessage['tool_calls'],
    }
  }
}

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
      if (useTools && err?.message?.toLowerCase().includes('does not support tools')) {
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

    for await (const part of chatStream) {
      if (signal?.aborted) break
      if (part.message.content) {
        text += part.message.content
        await onChunk(part.message.content)
      }
      if (part.done && (part.message as any).tool_calls?.length) {
        toolCalls = (part.message as any).tool_calls
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
      if (tools.length > 0 && err?.message?.toLowerCase().includes('does not support tools')) {
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

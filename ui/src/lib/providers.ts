export const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-…',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-…',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
  },
  {
    id: 'google',
    label: 'Google',
    placeholder: 'AIza…',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    placeholder: 'no key needed',
    models: [] as string[],
  },
] as const satisfies { id: string; label: string; placeholder: string; models: readonly string[] }[]

export type ProviderId = (typeof PROVIDERS)[number]['id']

export function detectProviderFromModel(model: string): ProviderId {
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('gpt-') || model.startsWith('o3') || model.startsWith('o4')) return 'openai'
  if (model.startsWith('gemini')) return 'google'
  return 'ollama'
}

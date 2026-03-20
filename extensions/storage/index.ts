import type { ExtensionAPI } from '@agent-smith/core'

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'storage_get',
    description: 'Retrieve a stored value by key',
    parameters: {
      properties: {
        key: { type: 'string', description: 'The storage key to retrieve' },
      },
      required: ['key'],
    },
    run: async ({ key }: { key: string }) => {
      const value = await api.storage.get(key)
      return value ?? null
    },
  })

  api.registerTool({
    name: 'storage_set',
    description: 'Store a value under a key for future retrieval',
    parameters: {
      properties: {
        key: { type: 'string', description: 'The storage key' },
        value: { description: 'The value to store (any JSON-serializable type)' },
      },
      required: ['key', 'value'],
    },
    run: async ({ key, value }: { key: string; value: any }) => {
      await api.storage.set(key, value)
      return 'stored'
    },
  })

  api.registerTool({
    name: 'storage_delete',
    description: 'Delete a stored value by key',
    parameters: {
      properties: {
        key: { type: 'string', description: 'The storage key to delete' },
      },
      required: ['key'],
    },
    run: async ({ key }: { key: string }) => {
      await api.storage.delete(key)
      return 'deleted'
    },
  })

  api.registerTool({
    name: 'storage_list',
    description: 'List all stored keys, optionally filtered by prefix',
    parameters: {
      properties: {
        prefix: { type: 'string', description: 'Optional prefix to filter keys' },
      },
      required: [],
    },
    run: async ({ prefix }: { prefix?: string }) => {
      return api.storage.list(prefix)
    },
  })
}

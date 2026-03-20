"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = register;
function register(api) {
    api.registerTool({
        name: 'storage_get',
        description: 'Retrieve a stored value by key',
        parameters: {
            properties: {
                key: { type: 'string', description: 'The storage key to retrieve' },
            },
            required: ['key'],
        },
        run: async ({ key }) => {
            const value = await api.storage.get(key);
            return value ?? null;
        },
    });
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
        run: async ({ key, value }) => {
            await api.storage.set(key, value);
            return 'stored';
        },
    });
    api.registerTool({
        name: 'storage_delete',
        description: 'Delete a stored value by key',
        parameters: {
            properties: {
                key: { type: 'string', description: 'The storage key to delete' },
            },
            required: ['key'],
        },
        run: async ({ key }) => {
            await api.storage.delete(key);
            return 'deleted';
        },
    });
    api.registerTool({
        name: 'storage_list',
        description: 'List all stored keys, optionally filtered by prefix',
        parameters: {
            properties: {
                prefix: { type: 'string', description: 'Optional prefix to filter keys' },
            },
            required: [],
        },
        run: async ({ prefix }) => {
            return api.storage.list(prefix);
        },
    });
}
//# sourceMappingURL=index.js.map
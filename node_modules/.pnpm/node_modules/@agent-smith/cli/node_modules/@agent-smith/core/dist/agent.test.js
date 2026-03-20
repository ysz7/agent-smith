"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ─── Minimal mocks ─────────────────────────────────────────────────────────────
function makeStorage() {
    const store = new Map();
    return {
        get: async (key) => store.get(key) ?? null,
        set: async (key, value) => { store.set(key, value); },
        delete: async (key) => { store.delete(key); },
        list: async (prefix) => [...store.keys()].filter(k => !prefix || k.startsWith(prefix)),
    };
}
function makeTransport() {
    const sent = [];
    let handler;
    const transport = {
        onMessage: (h) => { handler = h; },
        send: async (_id, msg) => { sent.push(msg); },
        broadcast: async (msg) => { sent.push(msg); },
    };
    return { transport, sent, trigger: (msg) => handler?.(msg) };
}
function makeScheduler() {
    const jobs = new Map();
    return {
        schedule: (id, cron, fn) => { jobs.set(id, { cron, fn }); },
        cancel: (id) => { jobs.delete(id); },
        list: () => [...jobs.entries()].map(([id, { cron }]) => ({ id, cron, enabled: true })),
    };
}
const BASE_CONFIG = {
    agent: { name: 'TestSmith', model: 'claude-sonnet-4-6' },
    apiKey: 'sk-ant-test',
    skills: {},
    extensions: {},
    multiAgent: {
        enabled: false,
        dynamic: { enabled: false, maxAgents: 10, autoDestroy: true },
        userCreated: { enabled: false, maxAgents: 10, persistAgents: true },
    },
    transport: { port: 3000, ui: true },
    performance: { historyWindow: 20, smartCompress: false, promptCaching: false },
};
// ─── ConfigManager mock ────────────────────────────────────────────────────────
const config_manager_1 = require("./config-manager");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// ─── Memory tests ──────────────────────────────────────────────────────────────
const memory_1 = require("./memory");
(0, vitest_1.describe)('Memory', () => {
    (0, vitest_1.it)('stores and retrieves messages', async () => {
        const memory = new memory_1.Memory(makeStorage());
        await memory.add({ role: 'user', content: 'Hello' });
        await memory.add({ role: 'assistant', content: 'Hi there!' });
        const msgs = await memory.getRecent(10);
        (0, vitest_1.expect)(msgs).toHaveLength(2);
        (0, vitest_1.expect)(msgs[0].role).toBe('user');
        (0, vitest_1.expect)(msgs[0].content).toBe('Hello');
        (0, vitest_1.expect)(msgs[1].role).toBe('assistant');
    });
    (0, vitest_1.it)('respects the window size in getRecent', async () => {
        const memory = new memory_1.Memory(makeStorage());
        for (let i = 0; i < 10; i++) {
            await memory.add({ role: 'user', content: `Message ${i}` });
        }
        const recent = await memory.getRecent(3);
        (0, vitest_1.expect)(recent).toHaveLength(3);
        (0, vitest_1.expect)(recent[2].content).toBe('Message 9');
    });
    (0, vitest_1.it)('reports needsCompression correctly', async () => {
        const memory = new memory_1.Memory(makeStorage());
        (0, vitest_1.expect)(await memory.needsCompression(5)).toBe(false);
        for (let i = 0; i < 6; i++) {
            await memory.add({ role: 'user', content: `msg ${i}` });
        }
        (0, vitest_1.expect)(await memory.needsCompression(5)).toBe(true);
    });
    (0, vitest_1.it)('compresses with summary', async () => {
        const memory = new memory_1.Memory(makeStorage());
        for (let i = 0; i < 5; i++) {
            await memory.add({ role: 'user', content: `old message ${i}` });
        }
        await memory.add({ role: 'user', content: 'recent message' });
        await memory.compressWithSummary('User asked about old things.', 1);
        const all = await memory.getAll();
        // Should have: 1 system summary + 1 recent message
        (0, vitest_1.expect)(all).toHaveLength(2);
        (0, vitest_1.expect)(all[0].role).toBe('system');
        (0, vitest_1.expect)(all[0].content).toContain('User asked about old things.');
        (0, vitest_1.expect)(all[1].content).toBe('recent message');
    });
    (0, vitest_1.it)('clears all messages', async () => {
        const memory = new memory_1.Memory(makeStorage());
        await memory.add({ role: 'user', content: 'test' });
        await memory.clear();
        (0, vitest_1.expect)(await memory.count()).toBe(0);
    });
});
// ─── ConfigManager tests ───────────────────────────────────────────────────────
(0, vitest_1.describe)('ConfigManager', () => {
    const tmpDir = path.join(os.tmpdir(), `agent-smith-test-${Date.now()}`);
    (0, vitest_1.it)('returns defaults when no config file exists', async () => {
        const mgr = new config_manager_1.ConfigManager(tmpDir);
        const config = await mgr.load();
        (0, vitest_1.expect)(config.agent.name).toBe('Smith');
        (0, vitest_1.expect)(config.transport.port).toBe(3000);
        (0, vitest_1.expect)(config.apiKey).toBe('');
    });
    (0, vitest_1.it)('persists and reloads config', async () => {
        const mgr = new config_manager_1.ConfigManager(tmpDir + '-persist');
        await mgr.setApiKey('sk-ant-test123');
        const config = await mgr.load();
        (0, vitest_1.expect)(config.apiKey).toBe('sk-ant-test123');
    });
    (0, vitest_1.it)('toggles skill enabled state', async () => {
        const mgr = new config_manager_1.ConfigManager(tmpDir + '-skill');
        await mgr.toggleSkill('memory', false);
        const config = await mgr.load();
        (0, vitest_1.expect)(config.skills['memory'].enabled).toBe(false);
    });
    (0, vitest_1.it)('creates and deletes tasks', async () => {
        const mgr = new config_manager_1.ConfigManager(tmpDir + '-tasks');
        const id = await mgr.createTask({
            name: 'Test task',
            cron: '0 9 * * *',
            instructions: 'Do something',
            enabled: true,
        });
        (0, vitest_1.expect)(typeof id).toBe('string');
        const tasks = await mgr.getTasks();
        (0, vitest_1.expect)(tasks.find(t => t.id === id)).toBeDefined();
        await mgr.deleteTask(id);
        const afterDelete = await mgr.getTasks();
        (0, vitest_1.expect)(afterDelete.find(t => t.id === id)).toBeUndefined();
    });
    (0, vitest_1.it)('records task run results', async () => {
        const mgr = new config_manager_1.ConfigManager(tmpDir + '-taskrun');
        const id = await mgr.createTask({
            name: 'Run test',
            cron: '* * * * *',
            instructions: 'Check something',
            enabled: true,
        });
        await mgr.recordTaskRun(id, 'success', 'All good');
        const tasks = await mgr.getTasks();
        const task = tasks.find(t => t.id === id);
        (0, vitest_1.expect)(task.lastStatus).toBe('success');
        (0, vitest_1.expect)(task.lastResult).toBe('All good');
        (0, vitest_1.expect)(task.lastRun).toBeDefined();
    });
});
// ─── LocalStorage tests ────────────────────────────────────────────────────────
const storage_1 = require("../transport/local/storage");
(0, vitest_1.describe)('LocalStorage', () => {
    const tmpDir = path.join(os.tmpdir(), `agent-smith-storage-${Date.now()}`);
    (0, vitest_1.it)('stores and retrieves a value', async () => {
        const storage = new storage_1.LocalStorage(tmpDir);
        await storage.set('test:key', { hello: 'world' });
        const val = await storage.get('test:key');
        (0, vitest_1.expect)(val).toEqual({ hello: 'world' });
    });
    (0, vitest_1.it)('returns null for missing key', async () => {
        const storage = new storage_1.LocalStorage(tmpDir + '-miss');
        const val = await storage.get('nonexistent:key');
        (0, vitest_1.expect)(val).toBeNull();
    });
    (0, vitest_1.it)('deletes a key', async () => {
        const storage = new storage_1.LocalStorage(tmpDir + '-del');
        await storage.set('del:me', 42);
        await storage.delete('del:me');
        (0, vitest_1.expect)(await storage.get('del:me')).toBeNull();
    });
    (0, vitest_1.it)('lists keys by prefix', async () => {
        const storage = new storage_1.LocalStorage(tmpDir + '-list');
        await storage.set('foo:a', 1);
        await storage.set('foo:b', 2);
        await storage.set('bar:c', 3);
        const fooKeys = await storage.list('foo');
        (0, vitest_1.expect)(fooKeys).toHaveLength(2);
        (0, vitest_1.expect)(fooKeys.every(k => k.startsWith('foo'))).toBe(true);
    });
});
//# sourceMappingURL=agent.test.js.map
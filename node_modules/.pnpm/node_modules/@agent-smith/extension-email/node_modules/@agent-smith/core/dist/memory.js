"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Memory = void 0;
const crypto_1 = require("crypto");
const HISTORY_KEY = 'memory:history';
const DEFAULT_COMPRESS_THRESHOLD = 30;
class Memory {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async add(msg) {
        const message = {
            id: (0, crypto_1.randomUUID)(),
            timestamp: new Date(),
            ...msg,
        };
        const history = await this.loadHistory();
        history.push(message);
        await this.storage.set(HISTORY_KEY, history);
    }
    async getRecent(count) {
        const history = await this.loadHistory();
        return history.slice(-count);
    }
    async getAll() {
        return this.loadHistory();
    }
    async clear() {
        await this.storage.set(HISTORY_KEY, []);
    }
    async count() {
        const history = await this.loadHistory();
        return history.length;
    }
    async needsCompression(threshold = DEFAULT_COMPRESS_THRESHOLD) {
        return (await this.count()) > threshold;
    }
    // Called by agent after generating a summary via Claude
    async compressWithSummary(summary, keepRecentCount) {
        const history = await this.loadHistory();
        const recent = history.slice(-keepRecentCount);
        const compressed = [
            {
                id: (0, crypto_1.randomUUID)(),
                role: 'system',
                content: `[Conversation summary] ${summary}`,
                timestamp: new Date(),
            },
            ...recent,
        ];
        await this.storage.set(HISTORY_KEY, compressed);
    }
    async loadHistory() {
        const history = await this.storage.get(HISTORY_KEY);
        if (!Array.isArray(history))
            return [];
        return history.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
        }));
    }
}
exports.Memory = Memory;
//# sourceMappingURL=memory.js.map
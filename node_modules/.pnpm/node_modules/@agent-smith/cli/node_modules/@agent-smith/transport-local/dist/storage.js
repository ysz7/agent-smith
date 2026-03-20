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
exports.LocalStorage = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class LocalStorage {
    dataDir;
    constructor(dataDir) {
        this.dataDir = dataDir ?? path.join(os.homedir(), '.agent-smith', 'data');
    }
    async get(key) {
        const filePath = this.keyToPath(key);
        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async set(key, value) {
        const filePath = this.keyToPath(key);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const handle = await fs.open(filePath, 'w');
        try {
            await handle.writeFile(JSON.stringify(value, null, 2), 'utf-8');
        }
        finally {
            await handle.close();
        }
    }
    async delete(key) {
        const filePath = this.keyToPath(key);
        try {
            await fs.unlink(filePath);
        }
        catch {
            // File already gone — that's fine
        }
    }
    async list(prefix) {
        try {
            const entries = await this.listDir(this.dataDir);
            return entries
                .map(e => this.pathToKey(e))
                .filter(k => !prefix || k.startsWith(prefix));
        }
        catch {
            return [];
        }
    }
    // Converts "memory:history" → "<dataDir>/memory/history.json"
    keyToPath(key) {
        const segments = key.split(':');
        return path.join(this.dataDir, ...segments) + '.json';
    }
    // Converts "<dataDir>/memory/history.json" → "memory:history"
    pathToKey(filePath) {
        const relative = path.relative(this.dataDir, filePath);
        const withoutExt = relative.replace(/\.json$/, '');
        return withoutExt.split(path.sep).join(':');
    }
    async listDir(dir) {
        const results = [];
        let entries;
        try {
            entries = await fs.readdir(dir);
        }
        catch {
            return [];
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = await fs.stat(fullPath).catch(() => null);
            if (!stat)
                continue;
            if (stat.isDirectory()) {
                results.push(...(await this.listDir(fullPath)));
            }
            else if (entry.endsWith('.json')) {
                results.push(fullPath);
            }
        }
        return results;
    }
}
exports.LocalStorage = LocalStorage;
//# sourceMappingURL=storage.js.map
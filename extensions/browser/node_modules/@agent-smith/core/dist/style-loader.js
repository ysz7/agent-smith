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
exports.StyleLoader = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
function parseFrontmatter(raw) {
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match)
        return { meta: {}, body: raw.trim() };
    const meta = {};
    for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx !== -1) {
            meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    }
    return { meta, body: match[2].trim() };
}
class StyleLoader {
    styleDirs;
    constructor(styleDirs) {
        this.styleDirs = styleDirs;
    }
    async list() {
        const seen = new Map();
        for (const dir of this.styleDirs) {
            let entries;
            try {
                const dirents = await fs.readdir(dir, { withFileTypes: true });
                entries = dirents.filter(d => d.isDirectory()).map(d => d.name);
            }
            catch {
                continue;
            }
            for (const entry of entries) {
                const stylePath = path.join(dir, entry, 'STYLE.md');
                try {
                    const raw = await fs.readFile(stylePath, 'utf-8');
                    const { meta, body } = parseFrontmatter(raw);
                    const name = meta.name ?? entry;
                    seen.set(name, {
                        name,
                        description: meta.description ?? '',
                        instructions: body,
                    });
                }
                catch {
                    // skip unreadable
                }
            }
        }
        return Array.from(seen.values());
    }
    async load(name) {
        const all = await this.list();
        return all.find(s => s.name === name) ?? null;
    }
}
exports.StyleLoader = StyleLoader;
//# sourceMappingURL=style-loader.js.map
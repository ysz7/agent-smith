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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillLoader = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const chokidar_1 = __importDefault(require("chokidar"));
class SkillLoader {
    config;
    skillDirs;
    skills = [];
    watcher;
    debounceTimer;
    constructor(config, 
    // Priority order: workspace > user > built-in (last wins on name collision)
    skillDirs) {
        this.config = config;
        this.skillDirs = skillDirs;
    }
    async load() {
        this.skills = [];
        for (const dir of this.skillDirs) {
            await this.loadFromDir(dir);
        }
        return [...this.skills];
    }
    async watch(onChange) {
        const existingDirs = [];
        for (const dir of this.skillDirs) {
            try {
                await fs.access(dir);
                existingDirs.push(dir);
            }
            catch {
                // Skip non-existent directories
            }
        }
        if (existingDirs.length === 0)
            return;
        this.watcher = chokidar_1.default.watch(existingDirs, { ignoreInitial: true });
        const reload = () => {
            if (this.debounceTimer)
                clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(async () => {
                const skills = await this.load();
                onChange(skills);
            }, 500);
        };
        this.watcher.on('add', reload);
        this.watcher.on('change', reload);
        this.watcher.on('unlink', reload);
    }
    getSkills() {
        return [...this.skills];
    }
    async stop() {
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        if (this.watcher)
            await this.watcher.close();
    }
    async loadFromDir(dir) {
        let entries;
        try {
            entries = await fs.readdir(dir);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const skillPath = path.join(dir, entry, 'SKILL.md');
            try {
                const raw = await fs.readFile(skillPath, 'utf-8');
                const { data, content } = (0, gray_matter_1.default)(raw);
                const skillName = data.name ?? entry;
                const configEntry = this.config.skills[skillName];
                // Not in config → enabled by default
                const enabledByConfig = configEntry?.enabled ?? true;
                // Check if required extensions are enabled
                const requires = data.requires?.extensions ?? [];
                const hasDisabledExtension = requires.some(ext => {
                    const extConfig = this.config.extensions[ext];
                    return extConfig?.enabled === false;
                });
                const skill = {
                    name: skillName,
                    description: data.description ?? '',
                    enabled: enabledByConfig && !hasDisabledExtension,
                    requires: requires.length > 0 ? { extensions: requires } : undefined,
                    config: { ...(data.config ?? {}), ...(configEntry?.config ?? {}) },
                    instructions: content.trim(),
                };
                // Override if already loaded (later dirs have higher priority)
                const existingIdx = this.skills.findIndex(s => s.name === skillName);
                if (existingIdx >= 0) {
                    this.skills[existingIdx] = skill;
                }
                else {
                    this.skills.push(skill);
                }
            }
            catch {
                // Skip invalid or missing SKILL.md
            }
        }
    }
}
exports.SkillLoader = SkillLoader;
//# sourceMappingURL=skill-loader.js.map
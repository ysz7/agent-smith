import type { Skill, AgentConfig } from './interfaces';
export declare class SkillLoader {
    private config;
    private skillDirs;
    private skills;
    private watcher?;
    private debounceTimer?;
    constructor(config: AgentConfig, skillDirs: string[]);
    load(): Promise<Skill[]>;
    watch(onChange: (skills: Skill[]) => void): Promise<void>;
    getSkills(): Skill[];
    stop(): Promise<void>;
    private loadFromDir;
}
//# sourceMappingURL=skill-loader.d.ts.map
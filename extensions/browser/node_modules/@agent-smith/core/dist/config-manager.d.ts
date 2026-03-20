import type { AgentConfig, IConfigManager, ScheduledTaskDefinition } from './interfaces';
export declare class ConfigManager implements IConfigManager {
    private configDir;
    private configPath;
    constructor(configDir?: string);
    load(): Promise<AgentConfig>;
    save(config: Partial<AgentConfig>): Promise<void>;
    setApiKey(apiKey: string): Promise<void>;
    toggleSkill(name: string, enabled: boolean): Promise<void>;
    toggleExtension(name: string, enabled: boolean): Promise<void>;
    updateSkillConfig(name: string, skillConfig: Record<string, any>): Promise<void>;
    getTasks(): Promise<ScheduledTaskDefinition[]>;
    createTask(task: Omit<ScheduledTaskDefinition, 'id'>): Promise<string>;
    updateTask(id: string, updates: Partial<ScheduledTaskDefinition>): Promise<void>;
    deleteTask(id: string): Promise<void>;
    recordTaskRun(id: string, status: 'success' | 'error', result: string): Promise<void>;
    private writeConfig;
    private loadRaw;
    private merge;
    private migrate;
}
//# sourceMappingURL=config-manager.d.ts.map
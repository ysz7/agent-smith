import type { IStorage, ITransport, IScheduler, IConfigManager, IHistory, AgentConfig, Skill } from './interfaces';
import type { ILimaMemory } from '@agent-smith/lima';
export declare class AgentSmith {
    private storage;
    private transport;
    private scheduler;
    private config;
    private configManager?;
    private tools;
    private memory;
    private skillLoader;
    private extensionLoader;
    private styleLoader;
    private systemPrompt;
    private client;
    private auditLogPath;
    private lima;
    constructor(storage: IStorage, transport: ITransport, scheduler: IScheduler, config: AgentConfig, skillDirs: string[], extensionDirs: string[], configManager?: IConfigManager | undefined, styleDirs?: string[], lima?: ILimaMemory, history?: IHistory);
    start(): Promise<void>;
    stop(): Promise<void>;
    getSkills(): Skill[];
    getExtensionNames(): string[];
    getDiscoveredExtensionNames(): string[];
    runScheduledTask(taskId: string, instructions: string): Promise<void>;
    private handleMessage;
    private thinkStream;
    private thinkWithMessages;
    private handleToolUse;
    private formatError;
    setStyle(name: string): Promise<void>;
    getStyles(): Promise<import('./style-loader').ResponseStyle[]>;
    private resolveApiKey;
    private buildSystemPrompt;
    private compress;
    private writeAuditLog;
    private registerLimaTools;
    private registerTaskTools;
}
//# sourceMappingURL=agent.d.ts.map
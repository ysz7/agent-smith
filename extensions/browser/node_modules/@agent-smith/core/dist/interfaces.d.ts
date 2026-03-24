export interface IStorage {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<string[]>;
}
export interface IncomingMessage {
    connectionId: string;
    type: string;
    content: string;
    agentId?: string;
    signal?: AbortSignal;
    image?: {
        data: string;
        mediaType: string;
    };
}
export interface OutgoingMessage {
    type: string;
    content?: string;
    data?: any;
}
export interface ITransport {
    onMessage(handler: (msg: IncomingMessage) => void): void;
    send(connectionId: string, message: OutgoingMessage): Promise<void>;
    broadcast(message: OutgoingMessage): Promise<void>;
}
export interface ScheduledJob {
    id: string;
    cron: string;
    name?: string;
    enabled: boolean;
    lastRun?: Date;
    lastStatus?: 'success' | 'error';
}
export interface ScheduledTaskDefinition {
    id: string;
    name: string;
    enabled: boolean;
    cron: string;
    instructions: string;
    lastRun?: string;
    lastStatus?: 'success' | 'error';
    lastResult?: string;
}
export interface IScheduler {
    schedule(id: string, cron: string, fn: () => void): void;
    cancel(id: string): void;
    list(): ScheduledJob[];
}
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    agentId?: string;
}
export interface IHistory {
    add(msg: Omit<Message, 'id' | 'timestamp'>): Promise<void>;
    getRecent(count: number): Promise<Message[]>;
    getAll(): Promise<Message[]>;
    clear(): Promise<void>;
    count(): Promise<number>;
    needsCompression(threshold?: number): Promise<boolean>;
    compressWithSummary(summary: string, keepRecentCount: number): Promise<void>;
}
export interface Skill {
    name: string;
    description: string;
    enabled: boolean;
    requires?: {
        extensions: string[];
    };
    config?: Record<string, any>;
    instructions?: string;
}
export interface ExtensionAPI {
    registerTool(tool: Tool): void;
    storage: IStorage;
    config: AgentConfig;
}
export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
    run(params: any): Promise<any>;
}
export interface AgentDefinition {
    role: 'orchestrator' | 'worker';
    model: string;
    skills?: Record<string, {
        enabled: boolean;
        config?: Record<string, any>;
    }>;
}
export interface UserAgentDefinition {
    id: string;
    name: string;
    model: string;
    systemPrompt?: string;
    createdAt: string;
}
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'stopped' | 'error';
export type AgentType = 'main' | 'user' | 'orchestrator';
export interface AgentRegistryEntry {
    id: string;
    name: string;
    type: AgentType;
    status: AgentStatus;
    model: string;
    createdAt: string;
    systemPrompt?: string;
    taskDescription?: string;
    abort?: () => void;
}
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'ollama';
/** Detect provider from model name */
export declare function detectProvider(model: string): AIProvider;
export interface AgentConfig {
    version?: number;
    agent: {
        name: string;
        model: string;
        systemPrompt?: string;
    };
    activeStyle?: string;
    apiKey: string;
    apiKeys?: Partial<Record<AIProvider, string>>;
    skills: Record<string, {
        enabled: boolean;
        config?: Record<string, any>;
    }>;
    extensions: Record<string, {
        enabled: boolean;
        config?: Record<string, any>;
    }>;
    multiAgent: {
        userCreated: {
            enabled: boolean;
            maxAgents: number;
            persistAgents: boolean;
        };
        orchestration: {
            enabled: boolean;
            maxConcurrent: number;
            defaultModel: string;
            autoDestroy: boolean;
        };
        agents?: Record<string, UserAgentDefinition>;
    };
    transport: {
        port: number;
        ui: boolean;
        localhostOnly?: boolean;
    };
    privacy?: {
        warnBeforeSendingFiles: boolean;
        localAuditLog: boolean;
        validateSkillsOnInstall: boolean;
    };
    performance?: {
        historyWindow: number;
        smartCompress: boolean;
        promptCaching: boolean;
        limaEnabled: boolean;
    };
    system?: {
        preventSleep: boolean;
        autoOpenBrowser: boolean;
        darkTheme: boolean;
        language: string;
        dailyBriefing?: boolean;
        lastOpenedDate?: string;
    };
    tasks?: Record<string, ScheduledTaskDefinition>;
    heartbeat?: {
        enabled: boolean;
        intervalMinutes: number;
    };
    ollama?: {
        host?: string;
        think?: boolean;
    };
}
export interface IConfigManager {
    load(): Promise<AgentConfig>;
    save(config: Partial<AgentConfig>): Promise<void>;
    setApiKey(apiKey: string): Promise<void>;
    toggleSkill(name: string, enabled: boolean): Promise<void>;
    toggleExtension(name: string, enabled: boolean): Promise<void>;
    updateExtensionConfig(name: string, config: Record<string, any>): Promise<void>;
    updateSkillConfig(name: string, config: Record<string, any>): Promise<void>;
    getTasks(): Promise<ScheduledTaskDefinition[]>;
    createTask(task: Omit<ScheduledTaskDefinition, 'id'>): Promise<string>;
    updateTask(id: string, updates: Partial<ScheduledTaskDefinition>): Promise<void>;
    deleteTask(id: string): Promise<void>;
    recordTaskRun(id: string, status: 'success' | 'error', result: string): Promise<void>;
    createUserAgent(def: UserAgentDefinition): Promise<void>;
    updateUserAgent(id: string, patch: Partial<Pick<UserAgentDefinition, 'name' | 'model' | 'systemPrompt'>>): Promise<void>;
    deleteUserAgent(id: string): Promise<void>;
}
//# sourceMappingURL=interfaces.d.ts.map
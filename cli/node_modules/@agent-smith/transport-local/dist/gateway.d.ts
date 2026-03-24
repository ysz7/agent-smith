import type { ITransport, IConfigManager, IncomingMessage, OutgoingMessage } from '@agent-smith/core';
import { AgentRegistry } from '@agent-smith/core';
import type { ILimaMemory } from '@agent-smith/lima';
export declare class LocalGateway implements ITransport {
    private port;
    private configManager;
    private uiDir?;
    private app;
    private server;
    private wss;
    private connections;
    private abortControllers;
    private messageHandler?;
    private userSkillsDir?;
    private skillsProvider?;
    private extensionsProvider?;
    private historyProvider?;
    private agentHistoryProvider?;
    private stylesProvider?;
    private setStyleHandler?;
    private lima?;
    private documentsDir?;
    private agentRegistry?;
    constructor(port: number, configManager: IConfigManager, uiDir?: string | undefined, userSkillsDir?: string);
    onMessage(handler: (msg: IncomingMessage) => void): void;
    send(connectionId: string, message: OutgoingMessage): Promise<void>;
    broadcast(message: OutgoingMessage): Promise<void>;
    setSkillsProvider(fn: () => {
        name: string;
        description: string;
        enabled: boolean;
        requires?: {
            extensions: string[];
        };
        config?: Record<string, any>;
    }[]): void;
    setExtensionsProvider(fn: () => {
        name: string;
        enabled: boolean;
    }[]): void;
    setHistoryProvider(fn: () => Promise<{
        id: string;
        role: string;
        content: string;
        timestamp: string;
    }[]>): void;
    setStylesProvider(fn: () => Promise<{
        name: string;
        description: string;
    }[]>): void;
    setSetStyleHandler(fn: (name: string) => Promise<void>): void;
    setLima(lima: ILimaMemory): void;
    setAgentHistoryProvider(fn: (agentId: string) => Promise<{
        id: string;
        role: string;
        content: string;
        timestamp: string;
    }[]>): void;
    setDocumentsDir(dir: string): void;
    setAgentRegistry(registry: AgentRegistry): void;
    private broadcastAgentStatus;
    start(hostname?: string): void;
    private setupMiddleware;
    private setupRoutes;
    private setupWebSocket;
}
//# sourceMappingURL=gateway.d.ts.map
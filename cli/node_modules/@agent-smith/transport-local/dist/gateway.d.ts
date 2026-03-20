import type { ITransport, IConfigManager, IncomingMessage, OutgoingMessage } from '@agent-smith/core';
export declare class LocalGateway implements ITransport {
    private port;
    private configManager;
    private uiDir?;
    private app;
    private server;
    private wss;
    private connections;
    private messageHandler?;
    private userSkillsDir?;
    private skillsProvider?;
    private extensionsProvider?;
    private historyProvider?;
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
    start(hostname?: string): void;
    private setupMiddleware;
    private setupRoutes;
    private setupWebSocket;
}
//# sourceMappingURL=gateway.d.ts.map
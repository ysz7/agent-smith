import type { Tool, IStorage, AgentConfig } from './interfaces';
export declare class ExtensionLoader {
    private config;
    private storage;
    private extensionDirs;
    private tools;
    private loadedNames;
    constructor(config: AgentConfig, storage: IStorage, extensionDirs: string[]);
    load(): Promise<void>;
    getTools(): Tool[];
    getLoadedNames(): string[];
    private loadFromDir;
}
//# sourceMappingURL=extension-loader.d.ts.map
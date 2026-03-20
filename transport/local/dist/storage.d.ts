import type { IStorage } from '@agent-smith/core';
export declare class LocalStorage implements IStorage {
    private dataDir;
    constructor(dataDir?: string);
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<string[]>;
    private keyToPath;
    private pathToKey;
    private listDir;
}
//# sourceMappingURL=storage.d.ts.map
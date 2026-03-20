import type { IStorage, Message } from './interfaces';
export declare class Memory {
    private storage;
    constructor(storage: IStorage);
    add(msg: Omit<Message, 'id' | 'timestamp'>): Promise<void>;
    getRecent(count: number): Promise<Message[]>;
    getAll(): Promise<Message[]>;
    clear(): Promise<void>;
    count(): Promise<number>;
    needsCompression(threshold?: number): Promise<boolean>;
    compressWithSummary(summary: string, keepRecentCount: number): Promise<void>;
    private loadHistory;
}
//# sourceMappingURL=memory.d.ts.map
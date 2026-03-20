export interface ResponseStyle {
    name: string;
    description: string;
    instructions: string;
}
export declare class StyleLoader {
    private styleDirs;
    constructor(styleDirs: string[]);
    list(): Promise<ResponseStyle[]>;
    load(name: string): Promise<ResponseStyle | null>;
}
//# sourceMappingURL=style-loader.d.ts.map
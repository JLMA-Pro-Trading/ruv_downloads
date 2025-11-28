/**
 * Tools command - List and install hackathon tools
 */
interface ToolsOptions {
    install?: string[];
    list?: boolean;
    check?: boolean;
    json?: boolean;
    quiet?: boolean;
    category?: string;
    available?: boolean;
}
export declare function toolsCommand(options: ToolsOptions): Promise<void>;
export {};
//# sourceMappingURL=tools.d.ts.map
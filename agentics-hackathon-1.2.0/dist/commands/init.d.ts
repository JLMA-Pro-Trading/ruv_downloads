/**
 * Init command - Interactive setup wizard for hackathon projects
 */
interface InitOptions {
    force?: boolean;
    yes?: boolean;
    tools?: string[];
    track?: string;
    team?: string;
    project?: string;
    mcp?: boolean;
    json?: boolean;
    quiet?: boolean;
}
export declare function initCommand(options: InitOptions): Promise<void>;
export {};
//# sourceMappingURL=init.d.ts.map
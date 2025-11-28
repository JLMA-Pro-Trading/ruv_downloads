/**
 * foxruv-agent init - Initialize FoxRuv infrastructure
 */
export interface InitOptions {
    force?: boolean;
    claudeMd?: boolean;
    skills?: boolean;
}
export declare function runInit(projectRoot: string, options?: InitOptions): Promise<void>;
//# sourceMappingURL=init.d.ts.map
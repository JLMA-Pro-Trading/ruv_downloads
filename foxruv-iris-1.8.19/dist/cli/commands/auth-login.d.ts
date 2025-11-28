/**
 * iris login command
 * Authenticate with IRIS managed service
 */
export declare function loginCommand(options: {
    key?: string;
    email?: string;
    register?: boolean;
}): Promise<void>;
export declare function logoutCommand(): Promise<void>;
export declare function statusCommand(): Promise<void>;
//# sourceMappingURL=auth-login.d.ts.map
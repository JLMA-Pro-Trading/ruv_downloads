export declare function login(): Promise<void>;
export declare function register(): Promise<void>;
export declare function logout(): Promise<void>;
export declare function checkAuth(): Promise<boolean>;
export declare function getCurrentUser(): Promise<{
    id: string;
    email: string;
    fullName: any;
} | null>;
//# sourceMappingURL=auth.d.ts.map
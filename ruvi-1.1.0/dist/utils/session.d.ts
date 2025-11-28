export interface SessionData {
    accessToken: string;
    refreshToken: string;
    userId: string;
    email: string;
    fullName?: string;
    expiresAt: number;
}
export declare function saveSession(session: SessionData): void;
export declare function loadSession(): SessionData | null;
export declare function clearSession(): void;
export declare function isSessionValid(): boolean;
//# sourceMappingURL=session.d.ts.map
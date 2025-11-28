import { Session } from '@supabase/supabase-js';
export type AuthViewType = 'sign_in' | 'sign_up' | 'magic_link' | 'forgotten_password' | 'update_password' | 'verify_otp';
export declare function getUserAPIKey(session: Session): Promise<string | undefined>;
export declare function useAuth(setAuthDialog: (value: boolean) => void, setAuthView: (value: AuthViewType) => void): {
    session: Session | null;
    apiKey: string | undefined;
};
//# sourceMappingURL=auth.d.ts.map
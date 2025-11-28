import { SupabaseClient } from '@supabase/supabase-js';
export declare function getSupabaseClient(): SupabaseClient & {
    supabaseUrl: string;
    supabaseKey: string;
};
export declare function setSupabaseSession(accessToken: string, refreshToken: string): void;
//# sourceMappingURL=supabase.d.ts.map
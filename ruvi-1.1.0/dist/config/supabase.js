import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';
// Load environment variables
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
    config({ path: envPath });
}
// Supabase configuration (using anon key - safe for client-side)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lgctetjaggzaykfngqzt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnY3RldGphZ2d6YXlrZm5ncXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDg3NjUsImV4cCI6MjA3NDc4NDc2NX0.zMCYI7vMl2PhzOgD5FGvXSmdbC3hppd63DKjRQ2-obM';
let supabaseClient = null;
export function getSupabaseClient() {
    if (!supabaseClient) {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false, // We'll handle session persistence manually
                autoRefreshToken: true,
            },
        });
    }
    // Add URL and key as properties for edge function access
    return Object.assign(supabaseClient, {
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_ANON_KEY,
    });
}
export function setSupabaseSession(accessToken, refreshToken) {
    const client = getSupabaseClient();
    client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
}
//# sourceMappingURL=supabase.js.map
import path from 'path';
import { TelemetryEmitter } from './telemetry-emitter.js';
// Singleton emitter used across the codebase.
export const telemetryEmitter = new TelemetryEmitter({
    telemetryApiUrl: process.env.TELEMETRY_API_URL,
    supabaseUrl: process.env.FOXRUV_SUPABASE_URL,
    supabaseServiceKey: process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY,
    tableName: 'model_run_log',
    summaryDir: path.join(process.cwd(), '.iris')
});

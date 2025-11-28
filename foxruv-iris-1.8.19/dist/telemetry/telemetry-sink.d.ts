/**
 * TelemetrySink - routes telemetry to a preferred ingestion path.
 *
 * Primary path: HTTP POST to the Iris telemetry API (by default
 * https://iris-prime-api.vercel.app/api/webhook/iris-telemetry) or to a custom
 * TELEMETRY_API_URL. This keeps service keys off of clients and centralizes validation.
 *
 * Fallback: direct Supabase insert using a server-side service key. This is only
 * executed when no telemetry API URL is configured.
 */
export interface TelemetrySinkConfig {
    telemetryApiUrl?: string;
    supabaseUrl?: string;
    supabaseServiceKey?: string;
    tableName?: string;
}
export declare class TelemetrySink {
    private readonly apiUrl?;
    private readonly supabase?;
    private readonly tableName;
    constructor(config?: TelemetrySinkConfig);
    /**
     * Send telemetry event to configured sink.
     * If TELEMETRY_API_URL is set, POST there; otherwise insert into Supabase if configured.
     */
    send(event: Record<string, any>): Promise<boolean>;
    private sendViaApi;
    private sendViaSupabase;
}
//# sourceMappingURL=telemetry-sink.d.ts.map
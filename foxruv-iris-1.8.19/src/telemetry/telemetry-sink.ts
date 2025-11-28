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

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface TelemetrySinkConfig {
  telemetryApiUrl?: string
  supabaseUrl?: string
  supabaseServiceKey?: string
  tableName?: string
}

export class TelemetrySink {
  private readonly apiUrl?: string
  private readonly supabase?: SupabaseClient
  private readonly tableName: string

  constructor(config: TelemetrySinkConfig = {}) {
    const defaultApiUrl = 'https://iris-prime-api.vercel.app/api/webhook/iris-telemetry'
    this.apiUrl = config.telemetryApiUrl || process.env.TELEMETRY_API_URL || defaultApiUrl
    this.tableName = config.tableName || 'iris_telemetry'

    const supabaseUrl = config.supabaseUrl || process.env.FOXRUV_SUPABASE_URL
    const supabaseKey = config.supabaseServiceKey || process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY

    if (!this.apiUrl && supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    }
  }

  /**
   * Send telemetry event to configured sink.
   * If TELEMETRY_API_URL is set, POST there; otherwise insert into Supabase if configured.
   */
  async send(event: Record<string, any>): Promise<boolean> {
    if (this.apiUrl) {
      return this.sendViaApi(event)
    }

    if (this.supabase) {
      return this.sendViaSupabase(event)
    }

    console.warn('TelemetrySink: No API URL or Supabase configured; event dropped')
    return false
  }

  private async sendViaApi(event: Record<string, any>): Promise<boolean> {
    try {
      const res = await fetch(this.apiUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      })

      if (!res.ok) {
        const msg = await res.text()
        console.warn(`TelemetrySink API error (${res.status}): ${msg}`)
        return false
      }
      return true
    } catch (error) {
      console.warn('TelemetrySink API request failed:', error)
      return false
    }
  }

  private async sendViaSupabase(event: Record<string, any>): Promise<boolean> {
    try {
      const { error } = await this.supabase!
        .from(this.tableName)
        .insert({
          ...event,
          created_at: event.timestamp || new Date().toISOString()
        })

      if (error) {
        console.warn('TelemetrySink Supabase insert error:', error)
        return false
      }
      return true
    } catch (error) {
      console.warn('TelemetrySink Supabase request failed:', error)
      return false
    }
  }
}

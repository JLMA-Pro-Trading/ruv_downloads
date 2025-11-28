/**
 * WhatsApp Webhook Handler for IRIS
 *
 * Handles incoming WhatsApp messages and responds with IRIS data.
 * Supports menu, status, drift, promos, and patterns commands.
 *
 * Usage:
 * - As Express middleware
 * - As Next.js API route
 * - As standalone handler
 *
 * @module whatsapp-webhook
 * @version 1.0.0
 */

import { irisPrime } from '../orchestrators/iris-prime.js'
import {
  formatProjectStatus,
  formatDriftSummary,
  formatMultiProjectStatus,
  formatPatternsSummary
} from './digest-builder.js'
import type { SupabaseLogger } from './supabase-logger.js'

/**
 * Webhook request body from Twilio
 */
export interface TwilioWebhookRequest {
  Body: string // Message text
  From: string // Sender's WhatsApp number
  To: string // Your Twilio number
  MessageSid: string
  [key: string]: string
}

/**
 * Webhook response
 */
export interface WebhookResponse {
  success: boolean
  reply: string
  error?: string
}

/**
 * WhatsApp command handler
 */
export class WhatsAppCommandHandler {
  private supabaseLogger?: SupabaseLogger
  private projectAliases: Map<string, string>

  constructor(supabaseLogger?: SupabaseLogger) {
    this.supabaseLogger = supabaseLogger

    // Project aliases for easier commands
    this.projectAliases = new Map([
      ['nfl', 'nfl-predictor'],
      ['nfl-predictor', 'nfl-predictor'],
      ['micro', 'microbiome-platform'],
      ['microbiome', 'microbiome-platform'],
      ['beclever', 'beclever-ai'],
      ['clever', 'beclever-ai']
    ])
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleMessage(body: string, from: string): Promise<string> {
    const command = body.trim().toLowerCase()

    console.log(`WhatsApp command from ${from}: "${command}"`)

    try {
      if (command === 'menu' || command === 'help') {
        return this.handleMenu()
      }

      if (command === 'status') {
        return await this.handleStatusAll()
      }

      if (command.startsWith('status ')) {
        const projectAlias = command.replace('status ', '').trim()
        return await this.handleStatusProject(projectAlias)
      }

      if (command === 'drift') {
        return await this.handleDrift()
      }

      if (command === 'promos' || command === 'promotions') {
        return await this.handlePromotions()
      }

      if (command === 'patterns') {
        return await this.handlePatterns()
      }

      if (command === 'health') {
        return await this.handleHealth()
      }

      // Unknown command
      return this.handleUnknown(command)
    } catch (error) {
      console.error('Error handling command:', error)
      return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nType \`menu\` for options.`
    }
  }

  /**
   * Handle menu command
   */
  private handleMenu(): string {
    return [
      '📋 *IRIS Menu*',
      '',
      '*General:*',
      '• `status` – all projects overview',
      '• `health` – health score summary',
      '• `drift` – drifted experts',
      '',
      '*Per-Project:*',
      '• `status nfl` – NFL predictor',
      '• `status micro` – Microbiome',
      '• `status beclever` – BeClever AI',
      '',
      '*Discovery:*',
      '• `promos` – recent promotions',
      '• `patterns` – transferable patterns',
      '',
      '• `help` – this menu'
    ].join('\n')
  }

  /**
   * Handle status for all projects
   */
  private async handleStatusAll(): Promise<string> {
    const projects = ['nfl-predictor', 'microbiome-platform', 'beclever-ai']
    const reports = await Promise.all(projects.map(p => irisPrime.evaluateProject(p)))

    return formatMultiProjectStatus(reports)
  }

  /**
   * Handle status for specific project
   */
  private async handleStatusProject(projectAlias: string): Promise<string> {
    const projectId = this.projectAliases.get(projectAlias)

    if (!projectId) {
      return `❓ Unknown project: "${projectAlias}"\n\nAvailable: nfl, micro, beclever`
    }

    const report = await irisPrime.evaluateProject(projectId)

    const displayName =
      projectAlias === 'nfl' || projectAlias === 'nfl-predictor'
        ? 'NFL Predictor'
        : projectAlias === 'micro' || projectAlias === 'microbiome'
        ? 'Microbiome Platform'
        : 'BeClever AI'

    return formatProjectStatus(displayName, report)
  }

  /**
   * Handle drift command
   */
  private async handleDrift(): Promise<string> {
    const projects = ['nfl-predictor', 'microbiome-platform', 'beclever-ai']
    const reports = await Promise.all(projects.map(p => irisPrime.evaluateProject(p)))

    return formatDriftSummary(reports)
  }

  /**
   * Handle promotions command
   */
  private async handlePromotions(): Promise<string> {
    if (!this.supabaseLogger) {
      return '⚠️ Promotion history requires Supabase integration'
    }

    const promotions = await this.supabaseLogger.getRecentPromotions(7)

    if (promotions.length === 0) {
      return '✨ *Recent Promotions*\n\n(none in last 7 days)'
    }

    const lines = ['✨ *Recent Promotions (Last 7 Days)*', '']

    for (const promo of promotions.slice(0, 5)) {
      const payload = promo.payload
      lines.push(`• ${payload.expertId} (${promo.project})`)
      lines.push(`  ${payload.oldVersion} → ${payload.newVersion}`)
      lines.push(`  Improvement: +${(payload.improvement * 100).toFixed(1)}%`)
      lines.push('')
    }

    if (promotions.length > 5) {
      lines.push(`...and ${promotions.length - 5} more`)
    }

    return lines.join('\n')
  }

  /**
   * Handle patterns command
   */
  private async handlePatterns(): Promise<string> {
    // Get patterns for all projects
    const microbiomePatterns = await irisPrime.findTransferablePatterns(
      'microbiome-platform',
      { requiresHistoricalData: true }
    )

    const nflPatterns = await irisPrime.findTransferablePatterns('nfl-predictor', {
      requiresHistoricalData: true
    })

    const allPatterns = [...microbiomePatterns, ...nflPatterns]

    return formatPatternsSummary(allPatterns)
  }

  /**
   * Handle health command
   */
  private async handleHealth(): Promise<string> {
    const crossReport = await irisPrime.evaluateAllProjects()

    const lines = ['💊 *IRIS Health Summary*', '']

    for (const project of crossReport.projects) {
      const icon =
        project.health === 'excellent'
          ? '🟢'
          : project.health === 'good'
          ? '🔵'
          : project.health === 'fair'
          ? '🟡'
          : project.health === 'poor'
          ? '🟠'
          : '🔴'

      lines.push(`${icon} ${project.projectId}: ${project.score}/100`)
    }

    lines.push('')
    lines.push(`Total alerts: ${crossReport.totalDriftAlerts}`)
    lines.push(`Transfer opportunities: ${crossReport.transferOpportunities}`)

    return lines.join('\n')
  }

  /**
   * Handle unknown command
   */
  private handleUnknown(command: string): string {
    return [
      `❓ Unknown command: "${command}"`,
      '',
      'Type `menu` for available commands'
    ].join('\n')
  }
}

/**
 * Create WhatsApp command handler
 */
export function createWhatsAppCommandHandler(
  supabaseLogger?: SupabaseLogger
): WhatsAppCommandHandler {
  return new WhatsAppCommandHandler(supabaseLogger)
}

/**
 * Express/Fastify middleware for WhatsApp webhook
 */
export function createWhatsAppWebhook(handler: WhatsAppCommandHandler) {
  return async (req: any, res: any) => {
    try {
      const body = req.body as TwilioWebhookRequest

      if (!body.Body) {
        res.status(400).send('Missing message body')
        return
      }

      const reply = await handler.handleMessage(body.Body, body.From)

      // Respond with TwiML
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(reply)}</Message>
</Response>`

      res.type('text/xml')
      res.send(twiml)
    } catch (error) {
      console.error('Webhook error:', error)
      res.status(500).send('Internal server error')
    }
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

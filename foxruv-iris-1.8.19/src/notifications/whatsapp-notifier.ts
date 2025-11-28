/**
 * WhatsApp Notifier for IRIS
 *
 * Sends critical alerts and daily digests to WhatsApp using Twilio.
 * Supports smart filtering to avoid spam.
 *
 * @module whatsapp-notifier
 * @version 1.0.0
 */

import type { IrisNotifier, IrisEvent, WhatsAppNotificationConfig } from './types.js'
import twilio from 'twilio'

/**
 * WhatsApp message sender interface
 */
interface WhatsAppSender {
  sendMessage(to: string, body: string): Promise<void>
}

/**
 * Twilio WhatsApp implementation
 */
export class TwilioWhatsAppSender implements WhatsAppSender {
  private client: any

  constructor() {
    // Lazy load Twilio to avoid requiring it if not used
    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN

    if (!twilioSid || !twilioToken) {
      throw new Error('Twilio credentials not configured')
    }

    this.client = twilio(twilioSid, twilioToken)
  }

  async sendMessage(to: string, body: string): Promise<void> {
    const from = process.env.TWILIO_WHATSAPP_FROM

    if (!from) {
      throw new Error('TWILIO_WHATSAPP_FROM not configured')
    }

    try {
      await this.client.messages.create({
        from,
        to,
        body
      })
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error)
      throw error
    }
  }
}

/**
 * WhatsApp Notifier for IRIS
 */
export class WhatsAppNotifier implements IrisNotifier {
  private sender: WhatsAppSender
  private config: Required<WhatsAppNotificationConfig>
  private recipientNumber: string

  constructor(
    config: Partial<WhatsAppNotificationConfig> = {},
    sender?: WhatsAppSender
  ) {
    this.config = {
      enabled: config.enabled ?? true,
      realtimeCriticalAlerts: config.realtimeCriticalAlerts ?? true,
      dailyDigest: config.dailyDigest ?? true,
      digestTime: config.digestTime ?? '09:00',
      allowedCommands: config.allowedCommands ?? [
        'menu',
        'status',
        'drift',
        'promos',
        'patterns',
        'help'
      ],
      rateLimitPerHour: config.rateLimitPerHour ?? 10
    }

    const recipientEnv = process.env.WHATSAPP_GROUP_OR_USER_TO || process.env.RUV_WHATSAPP_TO

    if (!recipientEnv) {
      throw new Error('WhatsApp recipient not configured (WHATSAPP_GROUP_OR_USER_TO or RUV_WHATSAPP_TO)')
    }

    this.recipientNumber = recipientEnv
    this.sender = sender || new TwilioWhatsAppSender()
  }

  /**
   * Send IRIS event notification
   */
  async send(event: IrisEvent): Promise<void> {
    if (!this.config.enabled) {
      console.log('WhatsApp notifications disabled')
      return
    }

    // Only send critical real-time alerts if enabled
    if (!this.shouldNotify(event)) {
      console.log(`Skipping WhatsApp for ${event.eventType} (${event.severity})`)
      return
    }

    const message = this.formatEvent(event)

    try {
      await this.sender.sendMessage(this.recipientNumber, message)
      console.log(`✓ WhatsApp notification sent: ${event.eventType}`)
    } catch (error) {
      console.error('Failed to send WhatsApp notification:', error)
    }
  }

  /**
   * Send daily digest message
   */
  async sendDigest(digestText: string): Promise<void> {
    if (!this.config.enabled || !this.config.dailyDigest) {
      console.log('Daily digest disabled')
      return
    }

    try {
      await this.sender.sendMessage(this.recipientNumber, digestText)
      console.log('✓ Daily digest sent to WhatsApp')
    } catch (error) {
      console.error('Failed to send daily digest:', error)
    }
  }

  /**
   * Determine if event should trigger WhatsApp notification
   */
  private shouldNotify(event: IrisEvent): boolean {
    // Daily digest is sent separately, not via event system
    if (event.eventType === 'IRIS_RUN_COMPLETED') {
      return false
    }

    // Real-time critical alerts
    if (this.config.realtimeCriticalAlerts && event.severity === 'critical') {
      return true
    }

    // Major promotions (optional)
    if (
      event.eventType === 'PROMOTION' &&
      event.payload.improvement &&
      event.payload.improvement > 0.15
    ) {
      // 15%+ improvement is significant
      return true
    }

    // Everything else goes to dashboard only
    return false
  }

  /**
   * Format event for WhatsApp
   */
  private formatEvent(event: IrisEvent): string {
    const { project, eventType, payload } = event

    switch (eventType) {
      case 'DRIFT_ALERT':
        return this.formatDriftAlert(project, payload)

      case 'PROMOTION':
        return this.formatPromotion(project, payload)

      case 'RETRAINING_COMPLETED':
        return this.formatRetraining(project, payload)

      case 'PATTERN_DISCOVERY':
        return this.formatPatternDiscovery(project, payload)

      default:
        return `🤖 IRIS: ${eventType} in ${project}`
    }
  }

  /**
   * Format drift alert
   */
  private formatDriftAlert(project: string, payload: any): string {
    return [
      `🚨 *IRIS Drift Alert*`,
      `Project: ${project}`,
      `Expert: ${payload.expertId}`,
      `Drift: ${(payload.percentageChange * 100).toFixed(1)}%`,
      `Current: ${(payload.currentValue * 100).toFixed(1)}%`,
      `Baseline: ${(payload.baselineValue * 100).toFixed(1)}%`,
      '',
      payload.triggerRetraining ? '🔄 Auto-retraining initiated' : '⚠️ Manual review needed'
    ].join('\n')
  }

  /**
   * Format promotion notification
   */
  private formatPromotion(project: string, payload: any): string {
    return [
      `✨ *IRIS Promotion*`,
      `Project: ${project}`,
      `Expert: ${payload.expertId}`,
      `Version: ${payload.oldVersion} → ${payload.newVersion}`,
      `Accuracy: ${(payload.oldAccuracy * 100).toFixed(1)}% → ${(payload.newAccuracy * 100).toFixed(1)}%`,
      `Improvement: +${(payload.improvement * 100).toFixed(1)}%`
    ].join('\n')
  }

  /**
   * Format retraining notification
   */
  private formatRetraining(project: string, payload: any): string {
    return [
      `🔄 *Retraining Complete*`,
      `Project: ${project}`,
      `Expert: ${payload.expertId}`,
      `Old accuracy: ${(payload.oldAccuracy * 100).toFixed(1)}%`,
      `New accuracy: ${(payload.newAccuracy * 100).toFixed(1)}%`,
      `Improvement: ${payload.improvement >= 0 ? '+' : ''}${(payload.improvement * 100).toFixed(1)}%`
    ].join('\n')
  }

  /**
   * Format pattern discovery notification
   */
  private formatPatternDiscovery(project: string, payload: any): string {
    return [
      `🔍 *Pattern Discovery*`,
      `Target: ${project}`,
      `Pattern: "${payload.patternName}"`,
      `Source: ${payload.sourceProject}`,
      `Transfer potential: ${(payload.transferPotential * 100).toFixed(0)}%`,
      `Adaptation: ${payload.adaptationRequired}`
    ].join('\n')
  }
}

/**
 * Create WhatsApp notifier
 */
export function createWhatsAppNotifier(
  config?: Partial<WhatsAppNotificationConfig>
): WhatsAppNotifier {
  return new WhatsAppNotifier(config)
}

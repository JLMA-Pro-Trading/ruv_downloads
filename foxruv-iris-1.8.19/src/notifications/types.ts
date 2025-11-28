/**
 * Notification Types for IRIS
 *
 * Defines event types, severity levels, and notifier interfaces
 * for IRIS alerts and daily digests.
 *
 * @module notification-types
 * @version 1.0.0
 */

/**
 * Event severity level
 */
export type IrisEventSeverity = 'info' | 'warning' | 'critical'

/**
 * Event type
 */
export type IrisEventType =
  | 'DRIFT_ALERT'
  | 'PROMOTION'
  | 'ROTATION'
  | 'PATTERN_DISCOVERY'
  | 'RETRAINING_STARTED'
  | 'RETRAINING_COMPLETED'
  | 'IRIS_RUN_COMPLETED'
  | 'HEALTH_CHECK'

/**
 * IRIS event structure
 */
export interface IrisEvent {
  runId: string
  project: string
  eventType: IrisEventType
  severity: IrisEventSeverity
  payload: Record<string, any>
  createdAt: Date
}

/**
 * Notifier interface
 */
export interface IrisNotifier {
  send(event: IrisEvent): Promise<void>
}

/**
 * Daily digest structure
 */
export interface DailyDigest {
  date: string
  projects: string[]
  drift: {
    critical: Array<{
      project: string
      expertId: string
      drop: number
    }>
    warnings: Array<{
      project: string
      expertId: string
      drop: number
    }>
  }
  promotions: Array<{
    project: string
    expertId: string
    oldVersion: string
    newVersion: string
    oldAcc: number
    newAcc: number
  }>
  patterns: Array<{
    fromProject: string
    toProject: string
    name: string
    transferPotential: number
  }>
  healthSummary: {
    excellent: number
    good: number
    fair: number
    poor: number
    critical: number
  }
}

/**
 * WhatsApp notification configuration
 */
export interface WhatsAppNotificationConfig {
  enabled: boolean
  realtimeCriticalAlerts: boolean
  dailyDigest: boolean
  digestTime?: string // "09:00" UTC
  allowedCommands: string[]
  rateLimitPerHour?: number
}

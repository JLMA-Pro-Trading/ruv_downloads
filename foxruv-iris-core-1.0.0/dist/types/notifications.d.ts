/**
 * Notification Configuration Types
 *
 * Defines notification settings, digest structures, and
 * channel-specific configurations for IRIS alerts.
 *
 * @module @iris/core/types/notifications
 * @version 1.0.0
 */
/**
 * Daily Digest Structure
 *
 * Aggregated summary of IRIS activity for daily reports.
 * Includes drift alerts, promotions, patterns, and health metrics.
 */
export interface DailyDigest {
    /** Date of the digest (ISO format) */
    date: string;
    /** Projects included in this digest */
    projects: string[];
    /** Drift alert summary */
    drift: {
        /** Critical drift alerts */
        critical: Array<{
            project: string;
            expertId: string;
            drop: number;
        }>;
        /** Warning-level drift alerts */
        warnings: Array<{
            project: string;
            expertId: string;
            drop: number;
        }>;
    };
    /** Prompt promotions completed */
    promotions: Array<{
        project: string;
        expertId: string;
        oldVersion: string;
        newVersion: string;
        oldAcc: number;
        newAcc: number;
    }>;
    /** Cross-project pattern discoveries */
    patterns: Array<{
        fromProject: string;
        toProject: string;
        name: string;
        transferPotential: number;
    }>;
    /** Overall health distribution */
    healthSummary: {
        excellent: number;
        good: number;
        fair: number;
        poor: number;
        critical: number;
    };
}
/**
 * WhatsApp Notification Configuration
 *
 * Settings for WhatsApp integration including real-time alerts,
 * daily digests, and interactive commands.
 */
export interface WhatsAppNotificationConfig {
    /** Enable WhatsApp notifications */
    enabled: boolean;
    /** Send real-time critical alerts */
    realtimeCriticalAlerts: boolean;
    /** Send daily digest summary */
    dailyDigest: boolean;
    /** Time to send daily digest (HH:mm UTC format, e.g., "09:00") */
    digestTime?: string;
    /** Allowed interactive commands */
    allowedCommands: string[];
    /** Rate limit (messages per hour) */
    rateLimitPerHour?: number;
}
//# sourceMappingURL=notifications.d.ts.map
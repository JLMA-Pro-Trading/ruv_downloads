/**
 * WhatsApp Notifier for IRIS
 *
 * Sends critical alerts and daily digests to WhatsApp using Twilio.
 * Supports smart filtering to avoid spam.
 *
 * @module whatsapp-notifier
 * @version 1.0.0
 */
import type { IrisNotifier, IrisEvent, WhatsAppNotificationConfig } from './types.js';
/**
 * WhatsApp message sender interface
 */
interface WhatsAppSender {
    sendMessage(to: string, body: string): Promise<void>;
}
/**
 * Twilio WhatsApp implementation
 */
export declare class TwilioWhatsAppSender implements WhatsAppSender {
    private client;
    constructor();
    sendMessage(to: string, body: string): Promise<void>;
}
/**
 * WhatsApp Notifier for IRIS
 */
export declare class WhatsAppNotifier implements IrisNotifier {
    private sender;
    private config;
    private recipientNumber;
    constructor(config?: Partial<WhatsAppNotificationConfig>, sender?: WhatsAppSender);
    /**
     * Send IRIS event notification
     */
    send(event: IrisEvent): Promise<void>;
    /**
     * Send daily digest message
     */
    sendDigest(digestText: string): Promise<void>;
    /**
     * Determine if event should trigger WhatsApp notification
     */
    private shouldNotify;
    /**
     * Format event for WhatsApp
     */
    private formatEvent;
    /**
     * Format drift alert
     */
    private formatDriftAlert;
    /**
     * Format promotion notification
     */
    private formatPromotion;
    /**
     * Format retraining notification
     */
    private formatRetraining;
    /**
     * Format pattern discovery notification
     */
    private formatPatternDiscovery;
}
/**
 * Create WhatsApp notifier
 */
export declare function createWhatsAppNotifier(config?: Partial<WhatsAppNotificationConfig>): WhatsAppNotifier;
export {};
//# sourceMappingURL=whatsapp-notifier.d.ts.map
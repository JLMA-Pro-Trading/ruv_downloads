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
import type { SupabaseLogger } from './supabase-logger.js';
/**
 * Webhook request body from Twilio
 */
export interface TwilioWebhookRequest {
    Body: string;
    From: string;
    To: string;
    MessageSid: string;
    [key: string]: string;
}
/**
 * Webhook response
 */
export interface WebhookResponse {
    success: boolean;
    reply: string;
    error?: string;
}
/**
 * WhatsApp command handler
 */
export declare class WhatsAppCommandHandler {
    private supabaseLogger?;
    private projectAliases;
    constructor(supabaseLogger?: SupabaseLogger);
    /**
     * Handle incoming WhatsApp message
     */
    handleMessage(body: string, from: string): Promise<string>;
    /**
     * Handle menu command
     */
    private handleMenu;
    /**
     * Handle status for all projects
     */
    private handleStatusAll;
    /**
     * Handle status for specific project
     */
    private handleStatusProject;
    /**
     * Handle drift command
     */
    private handleDrift;
    /**
     * Handle promotions command
     */
    private handlePromotions;
    /**
     * Handle patterns command
     */
    private handlePatterns;
    /**
     * Handle health command
     */
    private handleHealth;
    /**
     * Handle unknown command
     */
    private handleUnknown;
}
/**
 * Create WhatsApp command handler
 */
export declare function createWhatsAppCommandHandler(supabaseLogger?: SupabaseLogger): WhatsAppCommandHandler;
/**
 * Express/Fastify middleware for WhatsApp webhook
 */
export declare function createWhatsAppWebhook(handler: WhatsAppCommandHandler): (req: any, res: any) => Promise<void>;
//# sourceMappingURL=whatsapp-webhook.d.ts.map
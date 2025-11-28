/**
 * Zapier + 2chat WhatsApp Notifier
 * Sends IRIS notifications via Zapier → 2chat → WhatsApp Group
 */
export interface Zapier2ChatConfig {
    webhookUrl: string;
    projectName?: string;
}
export interface ZapierWebhookResponse {
    id?: string;
    status?: string;
    [key: string]: unknown;
}
export declare class Zapier2ChatNotifier {
    private webhookUrl;
    private projectName;
    constructor(config: Zapier2ChatConfig);
    /**
     * Send a message to WhatsApp group via Zapier → 2chat
     */
    sendMessage(message: string): Promise<void>;
    /**
     * Send daily digest
     */
    sendDailyDigest(data: {
        projects: Array<{
            name: string;
            health: number;
            status: string;
        }>;
        driftAlerts: Array<{
            expert: string;
            project: string;
            drift: number;
        }>;
        patterns: Array<{
            name: string;
            transfer: string;
            match: number;
        }>;
        autoActions: Array<{
            action: string;
            result: string;
        }>;
    }): Promise<void>;
    /**
     * Send critical drift alert
     */
    sendDriftAlert(data: {
        project: string;
        expert: string;
        current: number;
        baseline: number;
        drop: number;
        autoRetrain: boolean;
    }): Promise<void>;
    /**
     * Send pattern discovery notification
     */
    sendPatternDiscovery(data: {
        pattern: string;
        sourceProject: string;
        targetProject: string;
        matchScore: number;
        impact: string;
    }): Promise<void>;
    /**
     * Send auto-retrain completion
     */
    sendRetrainComplete(data: {
        expert: string;
        project: string;
        oldVersion: string;
        newVersion: string;
        improvement: number;
    }): Promise<void>;
}
/**
 * Create Zapier + 2chat notifier
 */
export declare function createZapier2ChatNotifier(config: Zapier2ChatConfig): Zapier2ChatNotifier;
//# sourceMappingURL=zapier-2chat-notifier.d.ts.map
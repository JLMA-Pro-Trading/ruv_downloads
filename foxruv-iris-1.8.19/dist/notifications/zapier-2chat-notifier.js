/**
 * Zapier + 2chat WhatsApp Notifier
 * Sends IRIS notifications via Zapier → 2chat → WhatsApp Group
 */
export class Zapier2ChatNotifier {
    webhookUrl;
    projectName;
    constructor(config) {
        this.webhookUrl = config.webhookUrl;
        this.projectName = config.projectName || 'IRIS';
    }
    /**
     * Send a message to WhatsApp group via Zapier → 2chat
     */
    async sendMessage(message) {
        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    timestamp: new Date().toISOString(),
                    source: this.projectName,
                }),
            });
            if (!response.ok) {
                throw new Error(`Zapier webhook failed: ${response.statusText}`);
            }
            const result = await response.json();
            console.log('✅ Message sent via Zapier:', result.id || result.status);
        }
        catch (error) {
            console.error('❌ Failed to send via Zapier:', error);
            throw error;
        }
    }
    /**
     * Send daily digest
     */
    async sendDailyDigest(data) {
        const date = new Date().toLocaleDateString();
        let message = `🤖 *IRIS Daily Digest*\n📅 ${date}\n\n`;
        // Project Health
        message += `📊 *Project Health*\n`;
        data.projects.forEach(p => {
            message += `• ${p.name}: ${p.status} (${p.health}/100)\n`;
        });
        // Drift Alerts
        if (data.driftAlerts.length > 0) {
            message += `\n🚨 *Drift Alerts*\n`;
            data.driftAlerts.forEach(d => {
                message += `• ${d.expert} (${d.project}): ${d.drift}%\n`;
            });
        }
        // Pattern Discoveries
        if (data.patterns.length > 0) {
            message += `\n📈 *Pattern Discoveries*\n`;
            data.patterns.forEach(p => {
                message += `• ${p.name}\n  Transfer: ${p.transfer} (${p.match}% match)\n`;
            });
        }
        // Auto Actions
        if (data.autoActions.length > 0) {
            message += `\n🔄 *Auto Actions Taken*\n`;
            data.autoActions.forEach(a => {
                message += `• ${a.action}\n  ${a.result}\n`;
            });
        }
        message += `\nReply 'menu' for commands`;
        await this.sendMessage(message);
    }
    /**
     * Send critical drift alert
     */
    async sendDriftAlert(data) {
        const message = `🚨 *IRIS Drift Alert*

Project: ${data.project}
Expert: ${data.expert}
Current: ${data.current}%
Baseline: ${data.baseline}%
Drop: ${data.drop}%

${data.autoRetrain ? '🔄 Auto-retraining initiated...\nETA: 15 minutes' : '⚠️ Manual review required'}`;
        await this.sendMessage(message);
    }
    /**
     * Send pattern discovery notification
     */
    async sendPatternDiscovery(data) {
        const message = `📈 *New Pattern Discovered*

Pattern: "${data.pattern}"
Transfer: ${data.sourceProject} → ${data.targetProject}
Match: ${data.matchScore}%

💡 Impact: ${data.impact}`;
        await this.sendMessage(message);
    }
    /**
     * Send auto-retrain completion
     */
    async sendRetrainComplete(data) {
        const message = `✅ *Retrain Complete*

Expert: ${data.expert}
Project: ${data.project}
${data.oldVersion} → ${data.newVersion}

📈 Performance improved: +${data.improvement}%`;
        await this.sendMessage(message);
    }
}
/**
 * Create Zapier + 2chat notifier
 */
export function createZapier2ChatNotifier(config) {
    return new Zapier2ChatNotifier(config);
}

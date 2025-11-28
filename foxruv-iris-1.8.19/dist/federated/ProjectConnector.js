/**
 * Project Connector
 *
 * Manages webhook connections to target projects:
 * - Pushes approved decisions to projects
 * - Handles authentication and retries
 * - Monitors delivery status
 * - Provides feedback loop
 *
 * @module ProjectConnector
 */
import { EventEmitter } from 'events';
export class ProjectConnector extends EventEmitter {
    projects;
    deliveryHistory = [];
    constructor(projects = []) {
        super();
        this.projects = new Map(projects.map(p => [p.id, p]));
    }
    /**
     * Register a new project
     */
    registerProject(project) {
        this.projects.set(project.id, project);
        this.emit('project:registered', { projectId: project.id });
    }
    /**
     * Unregister a project
     */
    unregisterProject(projectId) {
        this.projects.delete(projectId);
        this.emit('project:unregistered', { projectId });
    }
    /**
     * Get project configuration
     */
    getProject(projectId) {
        return this.projects.get(projectId);
    }
    /**
     * List all registered projects
     */
    listProjects() {
        return Array.from(this.projects.values());
    }
    /**
     * Push pattern deployment to project
     */
    async pushPattern(projectId, deployment) {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        if (project.features?.acceptPatterns === false) {
            throw new Error(`Project ${projectId} does not accept pattern deployments`);
        }
        return this.deliver(project, {
            type: 'pattern_deployment',
            payload: deployment,
        });
    }
    /**
     * Push decision notification to project
     */
    async pushDecision(projectId, decision) {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        if (project.features?.acceptDecisions === false) {
            throw new Error(`Project ${projectId} does not accept decision notifications`);
        }
        return this.deliver(project, {
            type: 'decision_notification',
            payload: decision,
        });
    }
    /**
     * Request feedback from project
     */
    async requestFeedback(projectId, patternId) {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        if (project.features?.sendFeedback === false) {
            throw new Error(`Project ${projectId} does not send feedback`);
        }
        return this.deliver(project, {
            type: 'feedback_request',
            payload: { patternId },
        });
    }
    /**
     * Core delivery method with retry logic
     */
    async deliver(project, message, attempt = 1) {
        const startTime = Date.now();
        const maxAttempts = project.retry?.maxAttempts || 3;
        this.emit('delivery:start', {
            projectId: project.id,
            type: message.type,
            attempt,
        });
        try {
            const controller = new AbortController();
            const timeoutMs = (project.timeout || 30) * 1000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const headers = {
                'Content-Type': 'application/json',
                'X-FoxRUV-Prime': 'federated-control-plane',
                'X-Delivery-Attempt': attempt.toString(),
                ...project.headers,
            };
            if (project.authToken) {
                headers['Authorization'] = `Bearer ${project.authToken}`;
            }
            const response = await fetch(project.webhookUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(message),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = {
                projectId: project.id,
                success: true,
                statusCode: response.status,
                attempts: attempt,
                duration,
                timestamp: new Date(),
            };
            this.deliveryHistory.push(result);
            this.emit('delivery:success', result);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Retry if not max attempts
            if (attempt < maxAttempts) {
                const backoffMs = project.retry?.backoffMs || 1000;
                const delay = backoffMs * Math.pow(2, attempt - 1); // Exponential backoff
                this.emit('delivery:retry', {
                    projectId: project.id,
                    attempt,
                    maxAttempts,
                    delay,
                    error,
                });
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.deliver(project, message, attempt + 1);
            }
            // Max attempts reached, fail
            const result = {
                projectId: project.id,
                success: false,
                error: error,
                attempts: attempt,
                duration,
                timestamp: new Date(),
            };
            this.deliveryHistory.push(result);
            this.emit('delivery:failed', result);
            return result;
        }
    }
    /**
     * Get delivery history for a project
     */
    getDeliveryHistory(projectId, limit = 10) {
        return this.deliveryHistory
            .filter(d => d.projectId === projectId)
            .slice(-limit);
    }
    /**
     * Get delivery statistics for a project
     */
    getDeliveryStats(projectId) {
        const history = this.deliveryHistory.filter(d => d.projectId === projectId);
        const total = history.length;
        const successful = history.filter(d => d.success).length;
        const failed = total - successful;
        const successRate = total > 0 ? successful / total : 0;
        const averageDuration = total > 0
            ? history.reduce((sum, d) => sum + d.duration, 0) / total
            : 0;
        const averageAttempts = total > 0
            ? history.reduce((sum, d) => sum + d.attempts, 0) / total
            : 0;
        return {
            total,
            successful,
            failed,
            successRate,
            averageDuration,
            averageAttempts,
        };
    }
    /**
     * Test webhook connectivity
     */
    async testConnection(projectId) {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        return this.deliver(project, {
            type: 'connection_test',
            payload: {
                timestamp: new Date().toISOString(),
                message: 'Connection test from FoxRUV Prime',
            },
        });
    }
    /**
     * Broadcast message to all projects
     */
    async broadcast(message) {
        const results = new Map();
        const deliveries = Array.from(this.projects.values()).map(async (project) => {
            const result = await this.deliver(project, message);
            results.set(project.id, result);
        });
        await Promise.all(deliveries);
        this.emit('broadcast:complete', {
            total: this.projects.size,
            successful: Array.from(results.values()).filter(r => r.success).length,
        });
        return results;
    }
    /**
     * Get overall connector health
     */
    getHealth() {
        const recentHistory = this.deliveryHistory.slice(-100);
        const successful = recentHistory.filter(d => d.success).length;
        const overallSuccessRate = recentHistory.length > 0
            ? successful / recentHistory.length
            : 0;
        const averageDeliveryTime = recentHistory.length > 0
            ? recentHistory.reduce((sum, d) => sum + d.duration, 0) / recentHistory.length
            : 0;
        // Count unique projects that had successful deliveries recently
        const reachableProjects = new Set(recentHistory.filter(d => d.success).map(d => d.projectId)).size;
        return {
            totalProjects: this.projects.size,
            reachableProjects,
            overallSuccessRate,
            averageDeliveryTime,
        };
    }
}
export default ProjectConnector;

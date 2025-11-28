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
import type { CouncilDecision } from '../council/types/index.js';

export interface ProjectConfig {
  /** Project identifier */
  id: string;

  /** Project name */
  name: string;

  /** Webhook URL for receiving updates */
  webhookUrl: string;

  /** Authentication token */
  authToken?: string;

  /** Custom headers */
  headers?: Record<string, string>;

  /** Timeout in seconds */
  timeout?: number;

  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };

  /** Feature flags */
  features?: {
    acceptPatterns?: boolean;
    acceptDecisions?: boolean;
    sendFeedback?: boolean;
  };
}

export interface DeliveryResult {
  projectId: string;
  success: boolean;
  statusCode?: number;
  error?: Error;
  attempts: number;
  duration: number;
  timestamp: Date;
}

export interface PatternDeployment {
  type: 'pattern_deployment';
  patternId: string;
  decision: CouncilDecision;
  testResults?: any;
  rolloutPercentage?: number;
  metadata?: Record<string, any>;
}

export class ProjectConnector extends EventEmitter {
  private projects: Map<string, ProjectConfig>;
  private deliveryHistory: DeliveryResult[] = [];

  constructor(projects: ProjectConfig[] = []) {
    super();
    this.projects = new Map(projects.map(p => [p.id, p]));
  }

  /**
   * Register a new project
   */
  registerProject(project: ProjectConfig): void {
    this.projects.set(project.id, project);
    this.emit('project:registered', { projectId: project.id });
  }

  /**
   * Unregister a project
   */
  unregisterProject(projectId: string): void {
    this.projects.delete(projectId);
    this.emit('project:unregistered', { projectId });
  }

  /**
   * Get project configuration
   */
  getProject(projectId: string): ProjectConfig | undefined {
    return this.projects.get(projectId);
  }

  /**
   * List all registered projects
   */
  listProjects(): ProjectConfig[] {
    return Array.from(this.projects.values());
  }

  /**
   * Push pattern deployment to project
   */
  async pushPattern(
    projectId: string,
    deployment: PatternDeployment
  ): Promise<DeliveryResult> {
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
  async pushDecision(
    projectId: string,
    decision: CouncilDecision
  ): Promise<DeliveryResult> {
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
  async requestFeedback(
    projectId: string,
    patternId: string
  ): Promise<DeliveryResult> {
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
  private async deliver(
    project: ProjectConfig,
    message: any,
    attempt = 1
  ): Promise<DeliveryResult> {
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

      const headers: Record<string, string> = {
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

      const result: DeliveryResult = {
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

    } catch (error) {
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
      const result: DeliveryResult = {
        projectId: project.id,
        success: false,
        error: error as Error,
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
  getDeliveryHistory(projectId: string, limit = 10): DeliveryResult[] {
    return this.deliveryHistory
      .filter(d => d.projectId === projectId)
      .slice(-limit);
  }

  /**
   * Get delivery statistics for a project
   */
  getDeliveryStats(projectId: string): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageDuration: number;
    averageAttempts: number;
  } {
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
  async testConnection(projectId: string): Promise<DeliveryResult> {
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
  async broadcast(message: any): Promise<Map<string, DeliveryResult>> {
    const results = new Map<string, DeliveryResult>();

    const deliveries = Array.from(this.projects.values()).map(async project => {
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
  getHealth(): {
    totalProjects: number;
    reachableProjects: number;
    overallSuccessRate: number;
    averageDeliveryTime: number;
  } {
    const recentHistory = this.deliveryHistory.slice(-100);

    const successful = recentHistory.filter(d => d.success).length;
    const overallSuccessRate = recentHistory.length > 0
      ? successful / recentHistory.length
      : 0;

    const averageDeliveryTime = recentHistory.length > 0
      ? recentHistory.reduce((sum, d) => sum + d.duration, 0) / recentHistory.length
      : 0;

    // Count unique projects that had successful deliveries recently
    const reachableProjects = new Set(
      recentHistory.filter(d => d.success).map(d => d.projectId)
    ).size;

    return {
      totalProjects: this.projects.size,
      reachableProjects,
      overallSuccessRate,
      averageDeliveryTime,
    };
  }
}

export default ProjectConnector;

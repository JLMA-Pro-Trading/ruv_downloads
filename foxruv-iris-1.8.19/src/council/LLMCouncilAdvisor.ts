/**
 * LLMCouncilAdvisor
 * -----------------
 * Optional AI-driven council helper that sends telemetry/metric snapshots
 * to an LLM endpoint (e.g., OpenAI-compatible) to get recommendations.
 *
 * This is opt-in: requires AI_COUNCIL_ENDPOINT (and optionally AI_COUNCIL_API_KEY).
 */

export interface CouncilAdvice {
  recommendations: string[];
  rationale?: string;
  raw?: any;
}

export interface LLMCouncilConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class LLMCouncilAdvisor {
  private readonly endpoint?: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: LLMCouncilConfig = {}) {
    this.endpoint = config.endpoint || process.env.AI_COUNCIL_ENDPOINT;
    this.apiKey = config.apiKey || process.env.AI_COUNCIL_API_KEY;
    this.model = config.model || process.env.AI_COUNCIL_MODEL || 'gpt-4o-mini';
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  isEnabled(): boolean {
    return !!this.endpoint;
  }

  async proposeDecisions(metricsSnapshot: any): Promise<CouncilAdvice | null> {
    if (!this.endpoint) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are the council brain for a federated AI platform. Recommend safe, data-driven optimizations.'
            },
            {
              role: 'user',
              content: `Given this federated metrics snapshot, propose up to 3 prioritized actions with rationale:\n\n${JSON.stringify(metricsSnapshot)}`
            }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const msg = await res.text();
        console.warn(`LLMCouncilAdvisor: endpoint returned ${res.status} ${msg}`);
        return null;
      }

      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const recommendations = Array.isArray(content) ? content : [String(content)];

      return {
        recommendations,
        rationale: content,
        raw: data
      };
    } catch (error) {
      console.warn('LLMCouncilAdvisor: request failed', error);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

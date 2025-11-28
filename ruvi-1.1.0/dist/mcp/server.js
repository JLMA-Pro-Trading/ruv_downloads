import { FastMCP } from 'fastmcp';
import { getSupabaseClient, setSupabaseSession } from '../config/supabase.js';
import { loadSession } from '../utils/session.js';
import { z } from 'zod';
export function createMCPServer() {
    const mcp = new FastMCP({
        name: 'ruvi-cli',
        version: '1.0.0',
        instructions: 'MCP server for rUv Agentic Engineering CLI with AI chat and knowledge base search capabilities',
    });
    // Add AI Chat tool
    mcp.addTool({
        name: 'ai_chat',
        description: 'Chat with rUv AI assistant using RAG knowledge base. Supports streaming responses.',
        parameters: z.object({
            message: z.string().describe('The message to send to the AI assistant'),
            history: z.array(z.object({
                role: z.string(),
                content: z.string(),
            })).optional().describe('Optional conversation history'),
        }),
        execute: async ({ message, history = [] }) => {
            const session = loadSession();
            const supabase = getSupabaseClient();
            if (session) {
                setSupabaseSession(session.accessToken, session.refreshToken);
            }
            const messages = [
                ...history,
                { role: 'user', content: message },
            ];
            const { data, error } = await supabase.functions.invoke('ai-chat', {
                body: { messages },
            });
            if (error) {
                throw new Error(`AI chat failed: ${error.message}`);
            }
            // Collect streamed response
            let fullResponse = '';
            if (data) {
                const reader = data.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonData = JSON.parse(line.slice(6));
                                if (jsonData.choices?.[0]?.delta?.content) {
                                    fullResponse += jsonData.choices[0].delta.content;
                                }
                            }
                            catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: fullResponse,
                    },
                ],
            };
        },
    });
    // Add Semantic Search tool
    mcp.addTool({
        name: 'semantic_search',
        description: 'Search the rUv knowledge base using semantic vector search',
        parameters: z.object({
            query: z.string().describe('The search query'),
            limit: z.number().optional().default(5).describe('Maximum number of results to return'),
        }),
        execute: async ({ query, limit = 5 }) => {
            const session = loadSession();
            const supabase = getSupabaseClient();
            if (session) {
                setSupabaseSession(session.accessToken, session.refreshToken);
            }
            const { data, error } = await supabase.functions.invoke('semantic-search', {
                body: { query, limit },
            });
            if (error) {
                throw new Error(`Search failed: ${error.message}`);
            }
            const results = data?.results || [];
            const resultText = results.length > 0
                ? `Found ${results.length} results:\n\n${results.map((r, i) => `${i + 1}. ${r.content}`).join('\n\n')}`
                : 'No results found';
            return {
                content: [
                    {
                        type: 'text',
                        text: resultText,
                    },
                ],
            };
        },
    });
    // Add Profile resource
    mcp.addResource({
        uri: 'ruv://profile',
        name: 'rUv Profile',
        description: 'Get rUv professional profile and expertise',
        mimeType: 'application/json',
        load: async () => {
            const profile = {
                name: 'rUv (Reuven Cohen)',
                title: 'Independent AI Consultant & Enterprise AI Architecture Expert',
                expertise: [
                    'Enterprise AI Architecture & Strategy',
                    'Autonomous AI Agent Development',
                    'Multi-Agent System Orchestration',
                    'Cloud Computing & Infrastructure as a Service',
                    'Quantum-Resistant AI Architectures',
                    'Neural Network Trading Systems',
                ],
                featured_work: {
                    project: 'EY.ai - Enterprise AI Stack',
                    scale: '400,000+ employees, 1.5 million end users',
                    budget: '$1.4 billion',
                },
                links: {
                    github: 'https://github.com/ruvnet',
                    website: 'https://ruv.io',
                },
            };
            return {
                text: JSON.stringify(profile, null, 2),
                mimeType: 'application/json',
            };
        },
    });
    // Add Projects resource
    mcp.addResource({
        uri: 'ruv://projects',
        name: 'rUv Projects',
        description: 'Get list of featured projects and portfolio',
        mimeType: 'application/json',
        load: async () => {
            const projects = {
                featured: [
                    {
                        name: 'AgentDB',
                        description: 'Vector database optimized for AI agent workflows',
                        link: 'https://github.com/ruvnet/agentdb',
                    },
                    {
                        name: 'Claude-Flow v2',
                        description: 'Enterprise AI orchestration with swarm intelligence',
                    },
                    {
                        name: 'Neural Trader',
                        description: 'Autonomous trading system with neural networks',
                    },
                    {
                        name: 'FACT',
                        description: 'Revolutionary LLM data retrieval (sub-100ms, 60-90% cost reduction)',
                    },
                    {
                        name: 'QuDAG',
                        description: 'Quantum-resistant platform for autonomous AI agents',
                    },
                    {
                        name: 'strange-loops',
                        description: 'Real-time distributed systems (500K+ ticks/second)',
                    },
                ],
            };
            return {
                text: JSON.stringify(projects, null, 2),
                mimeType: 'application/json',
            };
        },
    });
    // Add Services resource
    mcp.addResource({
        uri: 'ruv://services',
        name: 'rUv Services',
        description: 'Get available coaching and consultation services',
        mimeType: 'application/json',
        load: async () => {
            const services = {
                coaching_sessions: [
                    {
                        duration: '15 minutes',
                        price: '$149',
                        description: 'Quick guidance session',
                        calendly: 'https://calendly.com/ruvnet/15min',
                    },
                    {
                        duration: '30 minutes',
                        price: '$299',
                        description: 'Strategic planning and consultation',
                        calendly: 'https://calendly.com/ruvnet/30min',
                        popular: true,
                    },
                    {
                        duration: '60 minutes',
                        price: '$499',
                        description: 'Deep-dive session on complex topics',
                        calendly: 'https://calendly.com/ruvnet/60min',
                    },
                ],
                tribe: {
                    name: 'Agentic Tribe',
                    price: '$250/month',
                    format: 'Bi-weekly 2-hour live sessions',
                    cohort_size: '~5 people',
                },
            };
            return {
                text: JSON.stringify(services, null, 2),
                mimeType: 'application/json',
            };
        },
    });
    return mcp;
}
export async function startMCPServer() {
    const mcp = createMCPServer();
    await mcp.start({ transportType: 'stdio' });
}
//# sourceMappingURL=server.js.map
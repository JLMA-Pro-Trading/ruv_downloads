#!/usr/bin/env node
/**
 * DSPy.ts Demo Runner
 *
 * Interactive CLI for running DSPy.ts examples
 *
 * Usage:
 *   npm run demo                    # Interactive mode
 *   npm run demo simple-qa          # Run specific demo
 *   npm run demo --list             # List all demos
 */
declare const DEMOS: {
    readonly 'simple-qa': {
        readonly name: "Simple Q&A with Chain-of-Thought";
        readonly description: "Basic question answering with step-by-step reasoning";
        readonly file: "./demos/simple-qa";
        readonly requiredEnv: readonly ["OPENROUTER_API_KEY"];
    };
    readonly 'rag-agentdb': {
        readonly name: "RAG with AgentDB";
        readonly description: "Retrieval-Augmented Generation using AgentDB vector search";
        readonly file: "./demos/rag-agentdb";
        readonly requiredEnv: readonly ["OPENROUTER_API_KEY"];
    };
    readonly 'reasoning-bank': {
        readonly name: "ReasoningBank Learning";
        readonly description: "Self-learning system with SAFLA algorithm";
        readonly file: "./demos/reasoning-bank";
        readonly requiredEnv: readonly ["OPENROUTER_API_KEY"];
    };
    readonly 'multi-agent': {
        readonly name: "Multi-Agent with Swarm";
        readonly description: "Orchestrated multi-agent system with handoffs";
        readonly file: "./demos/multi-agent";
        readonly requiredEnv: readonly ["OPENROUTER_API_KEY"];
    };
    readonly optimization: {
        readonly name: "MIPROv2 Optimization";
        readonly description: "Automatic prompt optimization with MIPROv2";
        readonly file: "./demos/optimization";
        readonly requiredEnv: readonly ["OPENROUTER_API_KEY"];
    };
    readonly 'program-of-thought': {
        readonly name: "Program-of-Thought Coding";
        readonly description: "Code generation and execution for math problems";
        readonly file: "./demos/program-of-thought";
        readonly requiredEnv: readonly ["OPENROUTER_API_KEY"];
    };
};
type DemoKey = keyof typeof DEMOS;
declare function listDemos(): void;
declare function runDemo(demoKey: DemoKey): Promise<void>;
export { runDemo, listDemos };

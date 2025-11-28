/**
 * ReAct Module
 *
 * Implements the ReAct (Reasoning + Acting) pattern where the model
 * alternates between reasoning about the problem and taking actions
 * using available tools.
 *
 * Based on: ReAct: Synergizing Reasoning and Acting in Language Models
 * (Yao et al., 2022)
 */
import { Module } from '../core/module';
import { Signature } from '../core/signature';
/**
 * ReActTool that can be used by the ReAct agent
 */
export interface ReActTool {
    /**
     * ReActTool name
     */
    name: string;
    /**
     * ReActTool description
     */
    description: string;
    /**
     * Execute the tool
     */
    execute: (input: string) => Promise<string>;
    /**
     * Optional parameters schema
     */
    parameters?: {
        name: string;
        description: string;
        required: boolean;
    }[];
}
/**
 * ReAct step in the reasoning trace
 */
export interface ReActStep {
    /**
     * Step type: thought, action, or observation
     */
    type: 'thought' | 'action' | 'observation';
    /**
     * Content of the step
     */
    content: string;
    /**
     * ReActTool used (for actions)
     */
    tool?: string;
    /**
     * Step number
     */
    stepNumber: number;
}
/**
 * ReAct module configuration
 */
export interface ReActConfig {
    name: string;
    signature: Signature;
    tools: ReActTool[];
    maxIterations?: number;
    strategy?: 'ReAct';
}
/**
 * ReAct module for reasoning and acting
 */
export declare class ReAct<TInput = any, TOutput = any> extends Module<TInput, TOutput & {
    reasoning: string;
    steps: ReActStep[];
}> {
    private tools;
    private maxIterations;
    /**
     * Create a ReAct module
     */
    constructor(config: ReActConfig);
    /**
     * Extend signature with ReAct outputs
     */
    private extendSignature;
    /**
     * Execute the ReAct loop
     */
    run(input: TInput): Promise<TOutput & {
        reasoning: string;
        steps: ReActStep[];
    }>;
    /**
     * Build thought generation prompt
     */
    private buildThoughtPrompt;
    /**
     * Build action generation prompt
     */
    private buildActionPrompt;
    /**
     * Extract thought from response
     */
    private extractThought;
    /**
     * Extract action from response
     */
    private extractAction;
    /**
     * Execute a tool
     */
    private executeTool;
    /**
     * Parse final answer from thought
     */
    private parseAnswer;
    /**
     * Build reasoning trace from steps
     */
    private buildReasoningTrace;
    /**
     * Extract fallback answer when max iterations reached
     */
    private extractFallbackAnswer;
}

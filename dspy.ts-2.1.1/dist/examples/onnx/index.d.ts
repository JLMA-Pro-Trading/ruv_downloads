import { Module } from '../../src/core/module';
import { Pipeline } from '../../src/core/pipeline';
interface TextInput {
    text: string;
}
interface SentimentOutput {
    sentiment: 'positive' | 'negative';
    confidence: number;
}
/**
 * Example module using ONNX model for sentiment classification
 */
declare class SentimentModule extends Module<TextInput, SentimentOutput> {
    private model;
    private features;
    private featureMap;
    constructor(modelPath: string);
    init(): Promise<void>;
    validateInput(input: TextInput): void;
    private textToFeatures;
    run(input: TextInput): Promise<SentimentOutput>;
    cleanup(): Promise<void>;
}
/**
 * Create and configure a sentiment analysis pipeline
 */
export declare function createSentimentAnalyzer(modelPath: string): Promise<[Pipeline, SentimentModule]>;
export {};

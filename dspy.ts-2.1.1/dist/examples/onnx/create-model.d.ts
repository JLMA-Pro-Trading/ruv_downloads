/**
 * Simple sentiment classifier model
 */
export declare class SentimentClassifier {
    fc1: any;
    relu: any;
    fc2: any;
    constructor(inputSize: number, hiddenSize: number);
    forward(x: any): any;
    to(deviceType: any): void;
    eval(): void;
}
/**
 * Create and export a sentiment classifier model
 */
export declare function createModel(): Promise<void>;
/**
 * Initialize model with pre-trained weights
 */
export declare function initializeWeights(model: SentimentClassifier): Promise<void>;

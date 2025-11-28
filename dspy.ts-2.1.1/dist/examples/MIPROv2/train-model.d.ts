interface TrainingConfig {
    inputSize: number;
    hiddenSize: number;
    outputSize: number;
    learningRate: number;
    epochs: number;
    batchSize: number;
}
declare class MIPROv2Model {
    private session;
    private config;
    constructor(config: TrainingConfig);
    init(): Promise<void>;
    forward(input: Float32Array): Promise<Float32Array>;
    save(path: string): Promise<void>;
}
declare function trainModel(trainingDataPath: string, config: TrainingConfig): Promise<MIPROv2Model>;
export { MIPROv2Model, trainModel };

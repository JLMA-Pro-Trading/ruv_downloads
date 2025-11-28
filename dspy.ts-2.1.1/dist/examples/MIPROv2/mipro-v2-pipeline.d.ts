import { Module } from '../../src/core/module';
import { LMDriver } from '../../src/lm/base';
export interface MIPROv2Input {
    text: string;
    context?: string;
}
export interface MIPROv2Output {
    result: string;
    confidence: number;
}
export declare class MIPROv2Module extends Module<MIPROv2Input, MIPROv2Output> {
    private model;
    private minLength;
    private maxLength;
    constructor(model: LMDriver);
    run(input: MIPROv2Input): Promise<MIPROv2Output>;
    private calculateConfidence;
}

/**
 * Bootstrap Few-Shot optimizer implementation
 */
import { Module } from '../core/module';
import { Optimizer, OptimizerConfig, TrainingExample, MetricFunction } from './base';
/**
 * Configuration for BootstrapFewShot optimizer
 */
export interface BootstrapConfig extends OptimizerConfig {
    maxLabeledDemos?: number;
    maxBootstrappedDemos?: number;
    minScore?: number;
}
/**
 * BootstrapFewShot optimizer that generates demonstrations using a teacher model
 */
export declare class BootstrapFewShot<TInput = any, TOutput = any> extends Optimizer<TInput, TOutput> {
    protected config: Required<BootstrapConfig>;
    private optimizedProgram;
    constructor(metric: MetricFunction<TInput, TOutput>, config?: BootstrapConfig);
    /**
     * Generate demonstrations using the teacher model
     */
    private generateDemonstrations;
    /**
     * Compile a program with bootstrap few-shot optimization
     */
    compile<T1 = TInput, T2 = TOutput>(program: Module<T1, T2>, trainset: TrainingExample<T1, T2>[] | Array<T1 & Partial<T2>>, valset?: TrainingExample<T1, T2>[] | Array<T1 & Partial<T2>>): Promise<Module<T1, T2>>;
    /**
     * Save the optimized program to a file
     */
    save(path: string, saveFieldMeta?: boolean): void;
    /**
     * Load an optimized program from a file
     */
    load(path: string): void;
}

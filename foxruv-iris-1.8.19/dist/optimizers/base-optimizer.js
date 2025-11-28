/**
 * Base Optimizer Interface
 *
 * Abstract class defining the contract for all optimization strategies.
 * Domain-agnostic - works for any AI task (trading, NLP, robotics, etc.)
 *
 * @module optimizers/base-optimizer
 * @version 1.0.0
 */
// ============================================================================
// Abstract Base Class
// ============================================================================
/**
 * Base optimizer that all optimization strategies must extend
 */
export class BaseOptimizer {
    config;
    constructor(config = {}) {
        this.config = {
            checkpointDir: config.checkpointDir || './checkpoints',
            verbose: config.verbose ?? true,
            seed: config.seed
        };
    }
    /**
     * Validate search space (called before optimization)
     */
    validateSearchSpace(space) {
        if (!space.parameters || space.parameters.length === 0) {
            throw new Error('Search space must have at least one parameter');
        }
        for (const param of space.parameters) {
            if (!param.name) {
                throw new Error('Parameter must have a name');
            }
            if (param.type === 'range' && !param.bounds) {
                throw new Error(`Range parameter '${param.name}' must have bounds`);
            }
            if (param.type === 'choice' && !param.values) {
                throw new Error(`Choice parameter '${param.name}' must have values`);
            }
            if (param.type === 'fixed' && param.value === undefined) {
                throw new Error(`Fixed parameter '${param.name}' must have a value`);
            }
        }
    }
    /**
     * Generate random configuration from search space (helper)
     */
    generateRandomConfiguration(space) {
        const config = {};
        for (const param of space.parameters) {
            if (param.type === 'range') {
                const [min, max] = param.bounds;
                if (param.log_scale) {
                    const logMin = Math.log(min);
                    const logMax = Math.log(max);
                    config[param.name] = Math.exp(logMin + Math.random() * (logMax - logMin));
                }
                else {
                    config[param.name] = min + Math.random() * (max - min);
                }
            }
            else if (param.type === 'choice') {
                const randomIndex = Math.floor(Math.random() * param.values.length);
                config[param.name] = param.values[randomIndex];
            }
            else {
                config[param.name] = param.value;
            }
        }
        return config;
    }
}

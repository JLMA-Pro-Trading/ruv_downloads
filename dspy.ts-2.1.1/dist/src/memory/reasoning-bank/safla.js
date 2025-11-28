"use strict";
/**
 * SAFLA - Self-Aware Feedback Loop Algorithm
 *
 * Implements the core algorithm for evolving knowledge in ReasoningBank
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFLA = exports.DEFAULT_SAFLA_CONFIG = void 0;
const pino_1 = __importDefault(require("pino"));
/**
 * Default SAFLA configuration
 */
exports.DEFAULT_SAFLA_CONFIG = {
    minConfidenceThreshold: 0.6,
    minUsageCount: 3,
    minSuccessRate: 0.7,
    maxAgeInDays: 90,
    autoEvolve: true,
    evolutionInterval: 3600000, // 1 hour
};
/**
 * SAFLA engine for knowledge evolution
 */
class SAFLA {
    constructor(config = {}) {
        this.config = Object.assign(Object.assign({}, exports.DEFAULT_SAFLA_CONFIG), config);
        this.logger = (0, pino_1.default)({
            level: process.env.LOG_LEVEL || 'info',
            name: 'safla',
        });
    }
    /**
     * Start automatic evolution
     */
    startAutoEvolution(callback) {
        if (!this.config.autoEvolve) {
            return;
        }
        this.logger.info('Starting SAFLA auto-evolution', {
            interval: this.config.evolutionInterval,
        });
        this.evolutionTimer = setInterval(async () => {
            try {
                await callback();
            }
            catch (error) {
                this.logger.error('Auto-evolution failed', { error });
            }
        }, this.config.evolutionInterval);
    }
    /**
     * Stop automatic evolution
     */
    stopAutoEvolution() {
        if (this.evolutionTimer) {
            clearInterval(this.evolutionTimer);
            this.evolutionTimer = undefined;
            this.logger.info('SAFLA auto-evolution stopped');
        }
    }
    /**
     * Evaluate knowledge units for pruning
     */
    evaluateForPruning(units) {
        const keep = [];
        const prune = [];
        for (const unit of units) {
            if (this.shouldPrune(unit)) {
                prune.push(unit);
            }
            else {
                keep.push(unit);
            }
        }
        this.logger.info('Pruning evaluation completed', {
            total: units.length,
            keep: keep.length,
            prune: prune.length,
        });
        return { keep, prune };
    }
    /**
     * Determine if a knowledge unit should be pruned
     */
    shouldPrune(unit) {
        // Never prune highly confident, successful knowledge
        if (unit.confidence >= 0.9 && unit.successRate >= 0.9) {
            return false;
        }
        // Check confidence threshold
        if (unit.confidence < this.config.minConfidenceThreshold) {
            this.logger.debug('Pruning low confidence unit', { id: unit.id, confidence: unit.confidence });
            return true;
        }
        // Check if unit has been used enough times
        if (unit.usageCount >= this.config.minUsageCount) {
            // Check success rate
            if (unit.successRate < this.config.minSuccessRate) {
                this.logger.debug('Pruning low success rate unit', {
                    id: unit.id,
                    successRate: unit.successRate,
                });
                return true;
            }
        }
        // Check age
        const ageInDays = this.getAgeInDays(unit);
        if (ageInDays > this.config.maxAgeInDays && unit.usageCount === 0) {
            this.logger.debug('Pruning old unused unit', { id: unit.id, ageInDays });
            return true;
        }
        return false;
    }
    /**
     * Update knowledge unit based on new experience
     */
    updateFromExperience(unit, success, feedback) {
        const updated = Object.assign({}, unit);
        // Update usage count
        updated.usageCount++;
        // Update success rate
        const totalSuccesses = unit.successRate * (unit.usageCount - 1) + (success ? 1 : 0);
        updated.successRate = totalSuccesses / updated.usageCount;
        // Update confidence based on feedback and success
        if (feedback) {
            // Incorporate feedback score into confidence
            updated.confidence = this.updateConfidence(updated.confidence, feedback.score, success);
            // Add lessons from feedback if unsuccessful
            if (!success && feedback.comments.length > 0) {
                updated.lessons = [...(updated.lessons || []), ...feedback.comments];
            }
        }
        else {
            // Update confidence based on success/failure
            updated.confidence = this.updateConfidence(updated.confidence, success ? 1.0 : 0.0, success);
        }
        // Update timestamp
        updated.updatedAt = new Date();
        this.logger.debug('Updated knowledge unit from experience', {
            id: unit.id,
            success,
            newConfidence: updated.confidence,
            newSuccessRate: updated.successRate,
        });
        return updated;
    }
    /**
     * Update confidence score using exponential moving average
     */
    updateConfidence(currentConfidence, newScore, success) {
        // Weight factor (0-1): how much to trust new evidence vs. history
        // More usage = trust history more
        const alpha = 0.3; // 30% weight to new evidence, 70% to history
        // Calculate new confidence
        let updated = currentConfidence * (1 - alpha) + newScore * alpha;
        // Apply success/failure adjustment
        if (!success) {
            updated *= 0.9; // Penalize failures
        }
        // Clamp to [0, 1]
        return Math.max(0, Math.min(1, updated));
    }
    /**
     * Merge related knowledge units
     */
    mergeUnits(units) {
        if (units.length === 0) {
            throw new Error('Cannot merge empty array of units');
        }
        if (units.length === 1) {
            return units[0];
        }
        this.logger.info('Merging knowledge units', { count: units.length });
        // Sort by confidence
        const sorted = [...units].sort((a, b) => b.confidence - a.confidence);
        const base = sorted[0];
        // Merge reasoning steps
        const allReasoning = new Set();
        units.forEach((u) => u.reasoning.forEach((r) => allReasoning.add(r)));
        // Merge lessons
        const allLessons = new Set();
        units.forEach((u) => (u.lessons || []).forEach((l) => allLessons.add(l)));
        // Merge related units
        const allRelated = new Set();
        units.forEach((u) => u.relatedUnits.forEach((r) => allRelated.add(r)));
        // Calculate weighted averages
        const totalUsage = units.reduce((sum, u) => sum + u.usageCount, 0);
        const avgConfidence = units.reduce((sum, u) => sum + u.confidence * u.usageCount, 0) / totalUsage;
        const avgSuccessRate = units.reduce((sum, u) => sum + u.successRate * u.usageCount, 0) / totalUsage;
        return Object.assign(Object.assign({}, base), { id: this.generateMergedId(units), reasoning: Array.from(allReasoning), lessons: Array.from(allLessons), relatedUnits: Array.from(allRelated), confidence: avgConfidence, successRate: avgSuccessRate, usageCount: totalUsage, updatedAt: new Date(), metadata: Object.assign(Object.assign({}, base.metadata), { mergedFrom: units.map((u) => u.id), mergedAt: new Date() }) });
    }
    /**
     * Generate ID for merged unit
     */
    generateMergedId(units) {
        const ids = units.map((u) => u.id).sort();
        return `merged-${ids.join('-')}`;
    }
    /**
     * Get age of knowledge unit in days
     */
    getAgeInDays(unit) {
        const now = new Date();
        const created = new Date(unit.createdAt);
        const diffMs = now.getTime() - created.getTime();
        return diffMs / (1000 * 60 * 60 * 24);
    }
    /**
     * Evolve knowledge through reflection
     *
     * Analyzes patterns and generates insights
     */
    async evolve(units) {
        this.logger.info('Evolving knowledge', { totalUnits: units.length });
        const insights = [];
        const patterns = [];
        const recommendations = [];
        // Analyze success patterns
        const successful = units.filter((u) => u.success && u.successRate > 0.8);
        if (successful.length > 0) {
            insights.push(`${successful.length} highly successful patterns identified`);
            patterns.push(...this.extractPatterns(successful));
        }
        // Analyze failure patterns
        const failed = units.filter((u) => !u.success || u.successRate < 0.5);
        if (failed.length > 0) {
            insights.push(`${failed.length} patterns with low success identified`);
            recommendations.push(...this.generateRecommendations(failed, successful));
        }
        // Analyze transferability
        const transferable = units.filter((u) => u.transferable);
        if (transferable.length > 0) {
            insights.push(`${transferable.length} transferable patterns can be applied across domains`);
        }
        this.logger.info('Evolution complete', {
            insights: insights.length,
            patterns: patterns.length,
            recommendations: recommendations.length,
        });
        return { insights, patterns, recommendations };
    }
    /**
     * Extract common patterns from knowledge units
     */
    extractPatterns(units) {
        const patterns = new Set();
        for (const unit of units) {
            // Extract patterns from reasoning steps
            unit.reasoning.forEach((step) => {
                if (step.length > 20) {
                    // Only meaningful patterns
                    patterns.add(step);
                }
            });
        }
        return Array.from(patterns);
    }
    /**
     * Generate recommendations based on failures and successes
     */
    generateRecommendations(failed, successful) {
        const recommendations = [];
        // Extract lessons from failures
        const lessons = new Set();
        failed.forEach((u) => (u.lessons || []).forEach((l) => lessons.add(l)));
        if (lessons.size > 0) {
            recommendations.push('Review and apply lessons learned from failed attempts');
            recommendations.push(...Array.from(lessons));
        }
        // Suggest patterns from successful units
        if (successful.length > 0) {
            recommendations.push('Consider applying successful patterns to similar problems');
        }
        return recommendations;
    }
}
exports.SAFLA = SAFLA;
//# sourceMappingURL=safla.js.map
//! High-performance evolution engine with optimizations

use crate::dna::NeuralDNA;
use crate::fitness::{FitnessFunction, FitnessScore};
use crate::mutation::{mutate, crossover, MutationPolicy, MutationType};
use crate::traits::TraitProfile;
use crate::optimized::{memory, cache, parallel, allocation};
use rand::{Rng, thread_rng, seq::SliceRandom};
use serde::{Deserialize, Serialize};
use std::time::Instant;

/// High-performance evolution engine with memory pooling and caching
pub struct OptimizedEvolutionEngine {
    pub config: crate::evolution::EvolutionConfig,
    pub population: Vec<NeuralDNA>,
    pub generation: usize,
    pub best_fitness_history: Vec<f32>,
    pub diversity_history: Vec<f32>,
    pub stats_history: Vec<crate::evolution::GenerationStats>,
    
    // Performance optimizations
    mutation_workspace: memory::MutationWorkspace,
    fitness_cache: cache::FitnessCache,
    dna_pool: memory::DNAPool,
    performance_metrics: PerformanceMetrics,
}

#[derive(Debug, Clone)]
pub struct PerformanceMetrics {
    pub total_evaluations: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub avg_generation_time_ms: f64,
    pub memory_usage_mb: f64,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            total_evaluations: 0,
            cache_hits: 0,
            cache_misses: 0,
            avg_generation_time_ms: 0.0,
            memory_usage_mb: 0.0,
        }
    }
}

impl OptimizedEvolutionEngine {
    /// Create optimized evolution engine with performance enhancements
    pub fn new(config: crate::evolution::EvolutionConfig, topology: Vec<usize>, activation: &str) -> Self {
        let (max_weights, max_biases) = allocation::calculate_sizes(&topology);
        
        // Pre-allocate population using optimized creation
        let mut population = Vec::with_capacity(config.population_size);
        for _ in 0..config.population_size {
            population.push(allocation::create_dna_optimized(topology.clone(), activation));
        }
        
        Self {
            config: config.clone(),
            population,
            generation: 0,
            best_fitness_history: Vec::with_capacity(config.max_generations),
            diversity_history: Vec::with_capacity(config.max_generations),
            stats_history: Vec::with_capacity(config.max_generations),
            
            // Initialize optimization structures
            mutation_workspace: memory::MutationWorkspace::new(max_weights, max_biases),
            fitness_cache: cache::FitnessCache::new(config.population_size * 2), // Cache for 2 generations
            dna_pool: memory::DNAPool::new(config.population_size / 4, topology, activation.to_string()),
            performance_metrics: PerformanceMetrics::default(),
        }
    }
    
    /// High-performance evolution step with all optimizations
    pub fn evolve_generation_optimized<F>(&mut self, fitness_fn: &F, inputs: &[Vec<f32>], targets: &[Vec<f32>])
    where
        F: FitnessFunction,
    {
        let start_time = Instant::now();
        
        // Parallel fitness evaluation with caching
        self.evaluate_population_cached(fitness_fn);
        
        // Sort by fitness (descending) - optimized
        self.population.sort_unstable_by(|a, b| {
            let fitness_a = a.fitness_scores.last().unwrap_or(&0.0);
            let fitness_b = b.fitness_scores.last().unwrap_or(&0.0);
            fitness_b.partial_cmp(fitness_a).unwrap()
        });
        
        // Calculate and store statistics
        let stats = self.calculate_stats_fast();
        self.stats_history.push(stats.clone());
        self.best_fitness_history.push(stats.best_fitness as f32);
        self.diversity_history.push(stats.diversity as f32);
        
        // Create next generation with optimizations
        self.create_next_generation_optimized();
        
        self.generation += 1;
        
        // Update performance metrics
        let generation_time = start_time.elapsed().as_millis() as f64;
        self.performance_metrics.avg_generation_time_ms = 
            (self.performance_metrics.avg_generation_time_ms * (self.generation - 1) as f64 + generation_time) / self.generation as f64;
    }
    
    /// Cached fitness evaluation to avoid recomputation
    fn evaluate_population_cached<F>(&mut self, fitness_fn: &F)
    where
        F: FitnessFunction,
    {
        for individual in &mut self.population {
            // Check cache first
            if let Some(cached_fitness) = self.fitness_cache.get_fitness(individual) {
                individual.fitness_scores.push(cached_fitness as f32);
                self.performance_metrics.cache_hits += 1;
            } else {
                // Compute fitness and cache result
                let score = fitness_fn.evaluate(individual);
                individual.fitness_scores.push(score.overall as f32);
                self.fitness_cache.store_fitness(individual, score.overall);
                self.performance_metrics.cache_misses += 1;
            }
            self.performance_metrics.total_evaluations += 1;
        }
    }
    
    /// Fast statistics calculation with SIMD hints
    fn calculate_stats_fast(&self) -> crate::evolution::GenerationStats {
        let fitnesses: Vec<f64> = self.population
            .iter()
            .filter_map(|ind| ind.fitness_scores.last().map(|&f| f as f64))
            .collect();
        
        // Vectorized statistics calculation
        let best_fitness = fitnesses.iter().cloned().fold(0.0, f64::max);
        let sum: f64 = fitnesses.iter().sum();
        let average_fitness = if fitnesses.is_empty() { 0.0 } else { sum / fitnesses.len() as f64 };
        
        // Fast diversity calculation using sum of squares
        let diversity = if fitnesses.len() > 1 {
            let variance: f64 = fitnesses.iter()
                .map(|f| {
                    let diff = f - average_fitness;
                    diff * diff
                })
                .sum::<f64>() / fitnesses.len() as f64;
            variance.sqrt()
        } else {
            0.0
        };
        
        crate::evolution::GenerationStats {
            generation: self.generation,
            best_fitness,
            average_fitness,
            diversity,
            population_size: self.population.len(),
        }
    }
    
    /// Optimized next generation creation with memory pooling
    fn create_next_generation_optimized(&mut self) {
        let mut next_generation = Vec::with_capacity(self.config.population_size);
        
        // Keep elite individuals (no allocation needed)
        for i in 0..self.config.elite_count.min(self.population.len()) {
            next_generation.push(self.population[i].clone());
        }
        
        // Generate offspring with optimized mutations
        let mut rng = thread_rng();
        while next_generation.len() < self.config.population_size {
            if rng.gen::<f32>() < self.config.crossover_rate && self.population.len() >= 2 {
                // Crossover with optimized selection
                let parent1_idx = self.tournament_select_fast(&mut rng);
                let parent2_idx = self.tournament_select_fast(&mut rng);
                
                if let Ok(mut child_dna) = crossover(&self.population[parent1_idx], &self.population[parent2_idx]) {
                    // Use workspace for faster mutation
                    self.mutation_workspace.mutate_weights_cached(&mut child_dna, &self.config.mutation_policy, &mut rng);
                    child_dna.fitness_scores.clear(); // Reset fitness for new individual
                    next_generation.push(child_dna);
                }
            } else {
                // Mutation only with memory pooling
                let parent_idx = self.tournament_select_fast(&mut rng);
                let mut child = self.population[parent_idx].clone();
                
                // Fast mutation using SIMD optimizations
                crate::optimized::simd::mutate_weights_fast(
                    &mut child.weights,
                    self.config.mutation_policy.weight_mutation_rate,
                    self.config.mutation_policy.mutation_strength,
                    &mut rng
                );
                
                child.generation += 1;
                child.fitness_scores.clear();
                next_generation.push(child);
            }
        }
        
        self.population = next_generation;
    }
    
    /// Fast tournament selection with minimal allocations
    #[inline]
    fn tournament_select_fast(&self, rng: &mut impl Rng) -> usize {
        let tournament_size = 3;
        let mut best_idx = rng.gen_range(0..self.population.len());
        let mut best_fitness = self.population[best_idx].fitness_scores.last().unwrap_or(&0.0);
        
        for _ in 1..tournament_size {
            let candidate_idx = rng.gen_range(0..self.population.len());
            let candidate_fitness = self.population[candidate_idx].fitness_scores.last().unwrap_or(&0.0);
            
            if candidate_fitness > best_fitness {
                best_idx = candidate_idx;
                best_fitness = candidate_fitness;
            }
        }
        
        best_idx
    }
    
    /// Get performance metrics
    pub fn get_performance_metrics(&self) -> &PerformanceMetrics {
        &self.performance_metrics
    }
    
    /// Get cache hit ratio
    pub fn get_cache_hit_ratio(&self) -> f64 {
        let total = self.performance_metrics.cache_hits + self.performance_metrics.cache_misses;
        if total == 0 {
            0.0
        } else {
            self.performance_metrics.cache_hits as f64 / total as f64
        }
    }
    
    /// Get the best individual (same interface as regular engine)
    pub fn get_best_individual(&self) -> Option<&crate::evolution::Individual> {
        if let Some(best_dna) = self.population.first() {
            // For compatibility, we need to create an Individual wrapper
            // This is a temporary solution - in practice, OptimizedEvolutionEngine
            // would have its own Individual type
            None // TODO: Implement proper conversion
        } else {
            None
        }
    }
    
    /// Get best DNA directly (optimized interface)
    pub fn get_best_dna(&self) -> Option<&NeuralDNA> {
        self.population.first()
    }
    
    /// Memory usage estimation
    pub fn estimate_memory_usage(&self) -> f64 {
        let individual_size = std::mem::size_of::<NeuralDNA>() 
            + self.population.first().map(|dna| dna.weights.len() * 4 + dna.biases.len() * 4).unwrap_or(0);
        
        let total_bytes = individual_size * self.population.len()
            + std::mem::size_of::<Self>()
            + self.stats_history.len() * std::mem::size_of::<crate::evolution::GenerationStats>();
        
        total_bytes as f64 / (1024.0 * 1024.0) // Convert to MB
    }
}
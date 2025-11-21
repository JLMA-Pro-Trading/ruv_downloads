//! Evolution engine for neural DNA populations

use crate::dna::NeuralDNA;
use crate::fitness::{FitnessFunction, FitnessScore};
use crate::mutation::{mutate, crossover, MutationPolicy, MutationType};
use crate::traits::TraitProfile;
use rand::{Rng, thread_rng, seq::SliceRandom};
use serde::{Deserialize, Serialize};

/// Individual in the population
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Individual {
    pub dna: NeuralDNA,
    pub fitness: Option<FitnessScore>,
    pub traits: TraitProfile,
}

impl Individual {
    pub fn new(dna: NeuralDNA) -> Self {
        Self {
            dna,
            fitness: None,
            traits: TraitProfile::default(),
        }
    }
    
    pub fn with_traits(dna: NeuralDNA, traits: TraitProfile) -> Self {
        Self {
            dna,
            fitness: None,
            traits,
        }
    }
}

/// Evolution configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionConfig {
    pub population_size: usize,
    pub elite_count: usize,
    pub mutation_policy: MutationPolicy,
    pub crossover_rate: f32,
    pub max_generations: usize,
    pub fitness_threshold: f64,
}

impl Default for EvolutionConfig {
    fn default() -> Self {
        Self {
            population_size: 100,
            elite_count: 10,
            mutation_policy: MutationPolicy::default(),
            crossover_rate: 0.7,
            max_generations: 1000,
            fitness_threshold: 0.95,
        }
    }
}

/// Statistics for a generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationStats {
    pub generation: usize,
    pub best_fitness: f64,
    pub average_fitness: f64,
    pub diversity: f64,
    pub population_size: usize,
}

/// Evolution engine
pub struct EvolutionEngine {
    pub config: EvolutionConfig,
    pub population: Vec<Individual>,
    pub generation: usize,
    pub best_fitness_history: Vec<f32>,
    pub diversity_history: Vec<f32>,
    pub stats_history: Vec<GenerationStats>,
}

impl EvolutionEngine {
    /// Create a new evolution engine
    pub fn new(config: EvolutionConfig, topology: Vec<usize>, activation: &str) -> Self {
        let mut population = Vec::with_capacity(config.population_size);
        
        for _ in 0..config.population_size {
            let dna = NeuralDNA::random(topology.clone(), activation);
            population.push(Individual::new(dna));
        }
        
        Self {
            config,
            population,
            generation: 0,
            best_fitness_history: Vec::new(),
            diversity_history: Vec::new(),
            stats_history: Vec::new(),
        }
    }
    
    /// Evolve for one generation
    pub fn evolve_generation<F>(&mut self, fitness_fn: &F, inputs: &[Vec<f32>], targets: &[Vec<f32>])
    where
        F: FitnessFunction,
    {
        // Evaluate fitness for all individuals
        for individual in &mut self.population {
            individual.fitness = Some(fitness_fn.evaluate(&individual.dna));
        }
        
        // Sort by fitness (descending)
        self.population.sort_by(|a, b| {
            let fitness_a = a.fitness.as_ref().unwrap().overall;
            let fitness_b = b.fitness.as_ref().unwrap().overall;
            fitness_b.partial_cmp(&fitness_a).unwrap()
        });
        
        // Calculate statistics
        let stats = self.calculate_stats();
        self.stats_history.push(stats.clone());
        self.best_fitness_history.push(stats.best_fitness as f32);
        self.diversity_history.push(stats.diversity as f32);
        
        // Create next generation
        let mut next_generation = Vec::with_capacity(self.config.population_size);
        
        // Keep elite individuals
        for i in 0..self.config.elite_count.min(self.population.len()) {
            next_generation.push(self.population[i].clone());
        }
        
        // Generate offspring
        let mut rng = thread_rng();
        while next_generation.len() < self.config.population_size {
            if rng.gen::<f32>() < self.config.crossover_rate && self.population.len() >= 2 {
                // Crossover
                let parent1 = self.tournament_select(&mut rng);
                let parent2 = self.tournament_select(&mut rng);
                
                if let Ok(child_dna) = crossover(&parent1.dna, &parent2.dna) {
                    let mut child = Individual::new(child_dna);
                    mutate(&mut child.dna, &self.config.mutation_policy, &MutationType::All);
                    next_generation.push(child);
                }
            } else {
                // Mutation only
                let parent = self.tournament_select(&mut rng);
                let mut child = parent.clone();
                mutate(&mut child.dna, &self.config.mutation_policy, &MutationType::All);
                child.fitness = None;
                next_generation.push(child);
            }
        }
        
        self.population = next_generation;
        self.generation += 1;
    }
    
    /// Tournament selection
    fn tournament_select(&self, rng: &mut impl Rng) -> &Individual {
        let tournament_size = 3;
        let mut best = &self.population[rng.gen_range(0..self.population.len())];
        
        for _ in 1..tournament_size {
            let candidate = &self.population[rng.gen_range(0..self.population.len())];
            if let (Some(candidate_fitness), Some(best_fitness)) = (&candidate.fitness, &best.fitness) {
                if candidate_fitness.overall > best_fitness.overall {
                    best = candidate;
                }
            }
        }
        
        best
    }
    
    /// Calculate generation statistics
    fn calculate_stats(&self) -> GenerationStats {
        let fitnesses: Vec<f64> = self.population
            .iter()
            .filter_map(|ind| ind.fitness.as_ref().map(|f| f.overall))
            .collect();
        
        let best_fitness = fitnesses.iter().cloned().fold(0.0, f64::max);
        let average_fitness = if fitnesses.is_empty() {
            0.0
        } else {
            fitnesses.iter().sum::<f64>() / fitnesses.len() as f64
        };
        
        // Simple diversity metric: standard deviation of fitnesses
        let diversity = if fitnesses.len() > 1 {
            let variance = fitnesses.iter()
                .map(|f| (f - average_fitness).powi(2))
                .sum::<f64>() / fitnesses.len() as f64;
            variance.sqrt()
        } else {
            0.0
        };
        
        GenerationStats {
            generation: self.generation,
            best_fitness,
            average_fitness,
            diversity,
            population_size: self.population.len(),
        }
    }
    
    /// Get the best individual
    pub fn get_best_individual(&self) -> Option<&Individual> {
        self.population.first()
    }
    
    /// Get current statistics
    pub fn get_statistics(&self) -> Option<&GenerationStats> {
        self.stats_history.last()
    }
    
    /// Check if evolution should stop
    pub fn should_stop(&self) -> bool {
        if self.generation >= self.config.max_generations {
            return true;
        }
        
        if let Some(best) = self.get_best_individual() {
            if let Some(fitness) = &best.fitness {
                return fitness.overall >= self.config.fitness_threshold;
            }
        }
        
        false
    }
    
    /// Run evolution for multiple generations
    pub fn run<F>(&mut self, fitness_fn: &F, inputs: &[Vec<f32>], targets: &[Vec<f32>]) -> Result<&Individual, String>
    where
        F: FitnessFunction,
    {
        while !self.should_stop() {
            self.evolve_generation(fitness_fn, inputs, targets);
        }
        
        self.get_best_individual()
            .ok_or_else(|| "No individuals in population".to_string())
    }
}
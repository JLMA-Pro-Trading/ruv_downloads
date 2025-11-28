//! Performance-optimized implementations for Neural DNA

use crate::dna::NeuralDNA;
use crate::mutation::{MutationPolicy, MutationType};
use std::sync::Arc;
use std::hint::black_box;

/// SIMD-optimized mutation operations
pub mod simd {
    use super::*;
    
    /// Fast vectorized weight mutation using manual SIMD-like operations
    #[inline]
    pub fn mutate_weights_fast(weights: &mut [f32], mutation_rate: f32, strength: f32, rng: &mut impl rand::Rng) {
        // Process in chunks for better cache locality
        const CHUNK_SIZE: usize = 8;
        
        for chunk in weights.chunks_mut(CHUNK_SIZE) {
            // Pre-generate random values for the chunk
            let mut randoms = [0.0f32; CHUNK_SIZE];
            let mut changes = [0.0f32; CHUNK_SIZE];
            
            for i in 0..chunk.len() {
                randoms[i] = rng.gen::<f32>();
                if randoms[i] < mutation_rate {
                    changes[i] = rng.gen_range(-strength..strength);
                }
            }
            
            // Apply mutations with bounds checking
            for (i, weight) in chunk.iter_mut().enumerate() {
                if randoms[i] < mutation_rate {
                    *weight = (*weight + changes[i]).clamp(-5.0, 5.0);
                }
            }
        }
    }
    
    /// Vectorized fitness calculation
    #[inline]
    pub fn calculate_complexity_score_fast(weights: &[f32], biases: &[f32]) -> f64 {
        // Use sum of squares for complexity with vectorization hints
        let weight_sum_sq: f64 = weights.iter()
            .map(|&w| (w as f64) * (w as f64))
            .sum();
        
        let bias_sum_sq: f64 = biases.iter()
            .map(|&b| (b as f64) * (b as f64))
            .sum();
        
        (weight_sum_sq + bias_sum_sq).sqrt() / (weights.len() + biases.len()) as f64
    }
}

/// Memory-optimized operations
pub mod memory {
    use super::*;
    
    /// Pre-allocated mutation workspace to avoid repeated allocations
    pub struct MutationWorkspace {
        temp_weights: Vec<f32>,
        temp_biases: Vec<f32>,
        random_buffer: Vec<f32>,
    }
    
    impl MutationWorkspace {
        pub fn new(max_weights: usize, max_biases: usize) -> Self {
            Self {
                temp_weights: Vec::with_capacity(max_weights),
                temp_biases: Vec::with_capacity(max_biases),
                random_buffer: Vec::with_capacity(max_weights.max(max_biases)),
            }
        }
        
        /// Mutate weights using pre-allocated buffers
        pub fn mutate_weights_cached(&mut self, dna: &mut NeuralDNA, policy: &MutationPolicy, rng: &mut impl rand::Rng) {
            self.random_buffer.clear();
            self.random_buffer.extend(
                (0..dna.weights.len()).map(|_| rng.gen::<f32>())
            );
            
            for (i, weight) in dna.weights.iter_mut().enumerate() {
                if self.random_buffer[i] < policy.weight_mutation_rate {
                    let change = rng.gen_range(-policy.mutation_strength..policy.mutation_strength);
                    *weight = (*weight + change).clamp(-5.0, 5.0);
                }
            }
        }
    }
    
    /// Pool for reusing DNA objects
    pub struct DNAPool {
        pool: Vec<NeuralDNA>,
        topology: Vec<usize>,
        activation: String,
    }
    
    impl DNAPool {
        pub fn new(capacity: usize, topology: Vec<usize>, activation: String) -> Self {
            let mut pool = Vec::with_capacity(capacity);
            for _ in 0..capacity {
                pool.push(NeuralDNA::new(topology.clone(), &activation));
            }
            
            Self { pool, topology, activation }
        }
        
        pub fn get(&mut self) -> Option<NeuralDNA> {
            self.pool.pop()
        }
        
        pub fn return_dna(&mut self, mut dna: NeuralDNA) {
            // Reset DNA to clean state before returning to pool
            dna.generation = 0;
            dna.fitness_scores.clear();
            if self.pool.len() < self.pool.capacity() {
                self.pool.push(dna);
            }
        }
    }
}

/// Cache-optimized evolution
pub mod cache {
    use super::*;
    use std::collections::HashMap;
    
    /// Fitness cache to avoid recomputation
    pub struct FitnessCache {
        cache: HashMap<u64, f64>,
        max_size: usize,
    }
    
    impl FitnessCache {
        pub fn new(max_size: usize) -> Self {
            Self {
                cache: HashMap::with_capacity(max_size),
                max_size,
            }
        }
        
        /// Simple hash for DNA state (weights + biases)
        fn hash_dna(&self, dna: &NeuralDNA) -> u64 {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            
            let mut hasher = DefaultHasher::new();
            
            // Hash topology
            dna.topology.hash(&mut hasher);
            dna.activation.hash(&mut hasher);
            
            // Hash weights (quantized to reduce floating point issues)
            for &weight in &dna.weights {
                ((weight * 1000.0) as i32).hash(&mut hasher);
            }
            
            // Hash biases
            for &bias in &dna.biases {
                ((bias * 1000.0) as i32).hash(&mut hasher);
            }
            
            hasher.finish()
        }
        
        pub fn get_fitness(&self, dna: &NeuralDNA) -> Option<f64> {
            let hash = self.hash_dna(dna);
            self.cache.get(&hash).copied()
        }
        
        pub fn store_fitness(&mut self, dna: &NeuralDNA, fitness: f64) {
            if self.cache.len() >= self.max_size {
                // Simple eviction: remove oldest (first inserted)
                if let Some(key) = self.cache.keys().next().copied() {
                    self.cache.remove(&key);
                }
            }
            
            let hash = self.hash_dna(dna);
            self.cache.insert(hash, fitness);
        }
    }
}

/// Parallel processing utilities
pub mod parallel {
    use super::*;
    use std::sync::Mutex;
    
    /// Parallel fitness evaluation for populations
    pub fn evaluate_population_parallel<F>(
        population: &[NeuralDNA], 
        fitness_fn: &F
    ) -> Vec<f64> 
    where 
        F: Fn(&NeuralDNA) -> f64 + Sync,
    {
        // For now, sequential implementation
        // TODO: Add rayon for true parallelism in future version
        population.iter()
            .map(|dna| fitness_fn(dna))
            .collect()
    }
    
    /// Batch mutation for multiple individuals
    pub fn mutate_batch(
        population: &mut [NeuralDNA],
        policy: &MutationPolicy,
        mutation_type: &MutationType,
    ) {
        // Process in batches for better cache locality
        const BATCH_SIZE: usize = 16;
        
        for batch in population.chunks_mut(BATCH_SIZE) {
            for dna in batch {
                crate::mutation::mutate(dna, policy, mutation_type);
            }
        }
    }
}

/// Fast allocation strategies
pub mod allocation {
    use super::*;
    
    /// Pre-calculate optimal sizes for different topologies
    pub fn calculate_sizes(topology: &[usize]) -> (usize, usize) {
        let weights = topology.windows(2)
            .map(|layers| layers[0] * layers[1])
            .sum();
        let biases = topology.iter().skip(1).sum();
        (weights, biases)
    }
    
    /// Create DNA with pre-allocated capacity
    #[inline]
    pub fn create_dna_optimized(topology: Vec<usize>, activation: &str) -> NeuralDNA {
        let (weight_count, bias_count) = calculate_sizes(&topology);
        
        let mut dna = NeuralDNA {
            weights: Vec::with_capacity(weight_count),
            biases: Vec::with_capacity(bias_count),
            topology,
            activation: activation.to_string(),
            generation: 0,
            mutation_rate: 0.1,
            fitness_scores: Vec::with_capacity(10), // Common max size
        };
        
        // Initialize with specific capacity to avoid reallocations
        dna.weights.resize(weight_count, 0.0);
        dna.biases.resize(bias_count, 0.0);
        
        // Fill with random values
        use rand::{thread_rng, Rng};
        let mut rng = thread_rng();
        for weight in &mut dna.weights {
            *weight = rng.gen_range(-1.0..1.0);
        }
        for bias in &mut dna.biases {
            *bias = rng.gen_range(-1.0..1.0);
        }
        
        dna
    }
}
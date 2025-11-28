//! # neurodna - Evolutionary Neural Networks with Genetic Encoding
//!
//! A Rust library for evolutionary neural network development using genetic-inspired
//! encoding, mutation strategies, and neurodivergent cognitive modeling.
//!
//! ## Features
//!
//! - 🧬 **DNA Encoding**: Represent neural networks as evolvable genetic sequences
//! - 🔄 **Mutation Engine**: Sophisticated mutation strategies for neural evolution
//! - 🎯 **Fitness Evaluation**: Multi-objective fitness scoring system
//! - 🧠 **Neurodivergent Traits**: Model cognitive diversity (ADHD, Autism spectrum, etc.)
//! - ⚡ **Evolution Engine**: Population-based evolutionary algorithms
//! - 🛠️ **CLI Tools**: Command-line utilities for training, spawning, and scoring
//! - 🌐 **WASM Support**: Deploy to web environments
//!
//! ## Quick Start
//!
//! ```rust
//! use neurodna::*;
//!
//! // Create a neural DNA instance
//! let dna = NeuralDNA::random(vec![4, 8, 4, 2], "sigmoid");
//!
//! // Apply mutations
//! let mut evolved_dna = dna.clone();
//! let policy = MutationPolicy::default();
//! mutate(&mut evolved_dna, &policy, &MutationType::All);
//!
//! // Evaluate fitness
//! let scorer = StandardFitnessScorer::new();
//! let fitness = scorer.evaluate(&evolved_dna);
//! println!("Fitness: {:.4}", fitness.overall);
//! ```

pub mod dna;
pub mod mutation;
pub mod fitness;
pub mod traits;
pub mod evolution;
pub mod optimized;
pub mod evolution_optimized;

// Re-export key types
pub use dna::{NeuralDNA, DNAError};
pub use mutation::{MutationPolicy, MutationType, mutate, crossover};
pub use fitness::{FitnessFunction, FitnessScore, StandardFitnessScorer};
pub use traits::{NeurodivergentTrait, TraitProfile, TraitCategory, TraitEffects};
pub use evolution::{EvolutionEngine, EvolutionConfig, Individual, GenerationStats};
pub use optimized::{simd, memory, cache, parallel, allocation};
pub use evolution_optimized::{OptimizedEvolutionEngine, PerformanceMetrics};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[cfg(target_arch = "wasm32")]
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[cfg(not(target_arch = "wasm32"))]
macro_rules! console_log {
    ($($t:tt)*) => (println!($($t)*))
}

// When targeting wasm32, use a smaller allocator
#[cfg(all(target_arch = "wasm32", feature = "wee_alloc"))]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Panic hook for better error messages in WASM
#[cfg(target_arch = "wasm32")]
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// WASM bindings
#[cfg(target_arch = "wasm32")]
mod wasm_bindings {
    use super::*;
    use serde_wasm_bindgen::{to_value, from_value};
    use crate::{mutation, optimized};

    // Set up better error handling in WASM
    #[wasm_bindgen(start)]
    pub fn main() {
        set_panic_hook();
    }

    #[wasm_bindgen]
    pub struct WasmNeuralDNA {
        inner: NeuralDNA,
    }

    #[wasm_bindgen]
    impl WasmNeuralDNA {
        #[wasm_bindgen(constructor)]
        pub fn new(topology: Vec<usize>, activation: String) -> Result<WasmNeuralDNA, JsValue> {
            Ok(WasmNeuralDNA {
                inner: NeuralDNA::new(topology, &activation),
            })
        }
        
        #[wasm_bindgen]
        pub fn random(topology: Vec<usize>, activation: String) -> Result<WasmNeuralDNA, JsValue> {
            Ok(WasmNeuralDNA {
                inner: NeuralDNA::random(topology, &activation),
            })
        }
        
        #[wasm_bindgen]
        pub fn to_json(&self) -> Result<String, JsValue> {
            self.inner.to_json()
                .map_err(|e| JsValue::from_str(&e.to_string()))
        }
        
        #[wasm_bindgen]
        pub fn from_json(json: &str) -> Result<WasmNeuralDNA, JsValue> {
            NeuralDNA::from_json(json)
                .map(|dna| WasmNeuralDNA { inner: dna })
                .map_err(|e| JsValue::from_str(&e.to_string()))
        }
        
        #[wasm_bindgen(getter)]
        pub fn weights(&self) -> Vec<f32> {
            self.inner.weights.clone()
        }
        
        #[wasm_bindgen(getter)]
        pub fn biases(&self) -> Vec<f32> {
            self.inner.biases.clone()
        }
        
        #[wasm_bindgen(getter)]
        pub fn topology(&self) -> Vec<usize> {
            self.inner.topology.clone()
        }
        
        #[wasm_bindgen(getter)]
        pub fn generation(&self) -> u32 {
            self.inner.generation
        }
        
        #[wasm_bindgen(getter)]
        pub fn mutation_rate(&self) -> f32 {
            self.inner.mutation_rate
        }
        
        #[wasm_bindgen(setter)]
        pub fn set_mutation_rate(&mut self, rate: f32) {
            self.inner.mutation_rate = rate;
        }
        
        #[wasm_bindgen]
        pub fn validate(&self) -> Result<(), JsValue> {
            self.inner.validate()
                .map_err(|e| JsValue::from_str(&e.to_string()))
        }
        
        #[wasm_bindgen]
        pub fn add_fitness_score(&mut self, score: f32) {
            self.inner.add_fitness_score(score);
        }
        
        #[wasm_bindgen]
        pub fn average_fitness(&self) -> f32 {
            self.inner.average_fitness()
        }
        
        #[wasm_bindgen]
        pub fn mutate(&mut self, mutation_type: String) -> Result<(), JsValue> {
            let policy = MutationPolicy::default();
            let mut_type = match mutation_type.as_str() {
                "weight" => MutationType::Weight,
                "bias" => MutationType::Bias,
                "topology" => MutationType::Topology,
                "activation" => MutationType::ActivationFunction,
                "specialization" => MutationType::Specialization,
                _ => MutationType::All,
            };
            
            mutate(&mut self.inner, &policy, &mut_type);
            Ok(())
        }
        
        #[wasm_bindgen]
        pub fn mutate_with_policy(&mut self, policy_json: &str, mutation_type: String) -> Result<(), JsValue> {
            let policy: MutationPolicy = serde_json::from_str(policy_json)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
                
            let mut_type = match mutation_type.as_str() {
                "weight" => MutationType::Weight,
                "bias" => MutationType::Bias,
                "topology" => MutationType::Topology,
                "activation" => MutationType::ActivationFunction,
                "specialization" => MutationType::Specialization,
                _ => MutationType::All,
            };
            
            mutate(&mut self.inner, &policy, &mut_type);
            Ok(())
        }
    }

    #[wasm_bindgen]
    pub fn crossover_dna(parent1: &WasmNeuralDNA, parent2: &WasmNeuralDNA) -> Result<WasmNeuralDNA, JsValue> {
        crossover(&parent1.inner, &parent2.inner)
            .map(|dna| WasmNeuralDNA { inner: dna })
            .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub struct WasmEvolutionEngine {
        engine: EvolutionEngine,
    }

    #[wasm_bindgen]
    impl WasmEvolutionEngine {
        #[wasm_bindgen(constructor)]
        pub fn new(
            population_size: usize,
            elite_count: usize,
            topology: Vec<usize>,
            activation: String,
        ) -> WasmEvolutionEngine {
            let mut config = EvolutionConfig::default();
            config.population_size = population_size;
            config.elite_count = elite_count;
            
            WasmEvolutionEngine {
                engine: EvolutionEngine::new(config, topology, &activation),
            }
        }
        
        #[wasm_bindgen]
        pub fn evolve_generation(&mut self) {
            // For WASM demo, use dummy fitness function
            use crate::fitness::MeanSquaredError;
            let fitness_fn = MeanSquaredError;
            
            // Dummy data for demo
            let inputs = vec![vec![0.0, 1.0], vec![1.0, 0.0]];
            let targets = vec![vec![1.0], vec![0.0]];
            
            self.engine.evolve_generation(&fitness_fn, &inputs, &targets);
        }
        
        #[wasm_bindgen(getter)]
        pub fn generation(&self) -> usize {
            self.engine.generation
        }
        
        #[wasm_bindgen]
        pub fn get_best_dna(&self) -> Option<WasmNeuralDNA> {
            self.engine.get_best_individual()
                .map(|individual| WasmNeuralDNA { inner: individual.dna.clone() })
        }
        
        #[wasm_bindgen]
        pub fn get_statistics(&self) -> JsValue {
            let stats = self.engine.get_statistics();
            to_value(&stats).unwrap_or(JsValue::NULL)
        }
        
        #[wasm_bindgen(getter)]
        pub fn best_fitness_history(&self) -> Vec<f32> {
            self.engine.best_fitness_history.clone()
        }
        
        #[wasm_bindgen(getter)]
        pub fn diversity_history(&self) -> Vec<f32> {
            self.engine.diversity_history.clone()
        }
    }

    // Utility functions for JavaScript
    #[wasm_bindgen]
    pub fn get_default_mutation_policy() -> String {
        serde_json::to_string(&MutationPolicy::default()).unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn get_aggressive_mutation_policy() -> String {
        serde_json::to_string(&MutationPolicy::aggressive()).unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn get_conservative_mutation_policy() -> String {
        serde_json::to_string(&MutationPolicy::conservative()).unwrap_or_default()
    }

    // Performance measurement utilities
    #[wasm_bindgen]
    pub struct PerformanceTimer {
        start: f64,
    }

    #[wasm_bindgen]
    impl PerformanceTimer {
        #[wasm_bindgen(constructor)]
        pub fn new() -> PerformanceTimer {
            let performance = web_sys::window()
                .expect("should have window")
                .performance()
                .expect("should have performance");
            PerformanceTimer {
                start: performance.now(),
            }
        }
        
        #[wasm_bindgen]
        pub fn elapsed(&self) -> f64 {
            let performance = web_sys::window()
                .expect("should have window")
                .performance()
                .expect("should have performance");
            performance.now() - self.start
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub use wasm_bindings::*;
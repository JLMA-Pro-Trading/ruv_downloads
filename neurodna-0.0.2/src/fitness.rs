//! Fitness evaluation system for neural DNA

use crate::dna::NeuralDNA;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Fitness score with detailed breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FitnessScore {
    pub overall: f64,
    pub components: HashMap<String, f64>,
    pub timestamp: u64,
}

impl FitnessScore {
    pub fn new(overall: f64) -> Self {
        Self {
            overall: overall.clamp(0.0, 1.0),
            components: HashMap::new(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
    
    pub fn with_component(mut self, name: &str, value: f64) -> Self {
        self.components.insert(name.to_string(), value);
        self
    }
}

/// Trait for fitness evaluation functions
pub trait FitnessFunction {
    fn evaluate(&self, dna: &NeuralDNA) -> FitnessScore;
    fn name(&self) -> &str;
}

/// Mean squared error fitness function
pub struct MeanSquaredError;

impl FitnessFunction for MeanSquaredError {
    fn evaluate(&self, dna: &NeuralDNA) -> FitnessScore {
        // Dummy implementation for now - would connect to actual network evaluation
        let complexity_penalty = dna.weights.len() as f64 * 0.001;
        let base_fitness = 0.5; // Would be computed from actual network performance
        let fitness = (base_fitness - complexity_penalty).max(0.0);
        
        FitnessScore::new(fitness)
            .with_component("accuracy", base_fitness)
            .with_component("complexity", complexity_penalty)
    }
    
    fn name(&self) -> &str {
        "MSE"
    }
}

/// Standard fitness scorer
pub struct StandardFitnessScorer;

impl StandardFitnessScorer {
    pub fn new() -> Self {
        Self
    }
}

impl FitnessFunction for StandardFitnessScorer {
    fn evaluate(&self, dna: &NeuralDNA) -> FitnessScore {
        // Use MeanSquaredError implementation
        let mse = MeanSquaredError;
        mse.evaluate(dna)
    }
    
    fn name(&self) -> &str {
        "Standard"
    }
}

impl Default for StandardFitnessScorer {
    fn default() -> Self {
        Self::new()
    }
}
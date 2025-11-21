//! DNA encoding and decoding for neural network architectures

use serde::{Deserialize, Serialize};
use std::fmt;
use rand::{Rng, thread_rng};

/// Errors that can occur during DNA operations
#[derive(Debug)]
pub enum DNAError {
    InvalidGeneValue(String),
    InvalidTopology(String),
    SerializationError(String),
    ValidationError(String),
}

impl fmt::Display for DNAError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            DNAError::InvalidGeneValue(msg) => write!(f, "Invalid gene value: {msg}"),
            DNAError::InvalidTopology(msg) => write!(f, "Invalid topology: {msg}"),
            DNAError::SerializationError(msg) => write!(f, "Serialization error: {msg}"),
            DNAError::ValidationError(msg) => write!(f, "Validation error: {msg}"),
        }
    }
}

impl std::error::Error for DNAError {}

/// Neural network DNA representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeuralDNA {
    pub weights: Vec<f32>,
    pub biases: Vec<f32>,
    pub topology: Vec<usize>,
    pub activation: String,
    pub generation: u32,
    pub mutation_rate: f32,
    pub fitness_scores: Vec<f32>,
}

impl NeuralDNA {
    /// Create a new neural DNA instance
    pub fn new(topology: Vec<usize>, activation: &str) -> Self {
        let mut rng = thread_rng();
        
        // Calculate total weights needed
        let total_weights = topology.windows(2)
            .map(|layers| layers[0] * layers[1])
            .sum();
        
        // Calculate total biases needed (all layers except input)
        let total_biases = topology.iter().skip(1).sum();
        
        Self {
            weights: (0..total_weights).map(|_| rng.gen_range(-1.0..1.0)).collect(),
            biases: (0..total_biases).map(|_| rng.gen_range(-1.0..1.0)).collect(),
            topology,
            activation: activation.to_string(),
            generation: 0,
            mutation_rate: 0.1,
            fitness_scores: Vec::new(),
        }
    }
    
    /// Create a random neural DNA instance
    pub fn random(topology: Vec<usize>, activation: &str) -> Self {
        Self::new(topology, activation)
    }
    
    /// Serialize to JSON
    pub fn to_json(&self) -> Result<String, DNAError> {
        serde_json::to_string(self)
            .map_err(|e| DNAError::SerializationError(e.to_string()))
    }
    
    /// Deserialize from JSON
    pub fn from_json(json: &str) -> Result<Self, DNAError> {
        serde_json::from_str(json)
            .map_err(|e| DNAError::SerializationError(e.to_string()))
    }
    
    /// Validate the DNA structure
    pub fn validate(&self) -> Result<(), DNAError> {
        if self.topology.len() < 2 {
            return Err(DNAError::ValidationError("Topology must have at least 2 layers".to_string()));
        }
        
        let expected_weights = self.topology.windows(2)
            .map(|layers| layers[0] * layers[1])
            .sum::<usize>();
        
        if self.weights.len() != expected_weights {
            return Err(DNAError::ValidationError(
                format!("Weight count mismatch: expected {}, got {}", expected_weights, self.weights.len())
            ));
        }
        
        let expected_biases: usize = self.topology.iter().skip(1).sum();
        if self.biases.len() != expected_biases {
            return Err(DNAError::ValidationError(
                format!("Bias count mismatch: expected {}, got {}", expected_biases, self.biases.len())
            ));
        }
        
        Ok(())
    }
    
    /// Add a fitness score
    pub fn add_fitness_score(&mut self, score: f32) {
        self.fitness_scores.push(score);
        // Keep only last 10 scores
        if self.fitness_scores.len() > 10 {
            self.fitness_scores.remove(0);
        }
    }
    
    /// Get average fitness
    pub fn average_fitness(&self) -> f32 {
        if self.fitness_scores.is_empty() {
            0.0
        } else {
            self.fitness_scores.iter().sum::<f32>() / self.fitness_scores.len() as f32
        }
    }
}
//! Mutation engine for neural DNA evolution

use crate::dna::NeuralDNA;
use rand::{Rng, thread_rng};
use serde::{Deserialize, Serialize};

/// Types of mutations available
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MutationType {
    Weight,
    Bias,
    Topology,
    ActivationFunction,
    Specialization,
    All,
}

/// Mutation policy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutationPolicy {
    pub weight_mutation_rate: f32,
    pub bias_mutation_rate: f32,
    pub topology_mutation_rate: f32,
    pub mutation_strength: f32,
    pub adaptive: bool,
}

impl Default for MutationPolicy {
    fn default() -> Self {
        Self {
            weight_mutation_rate: 0.1,
            bias_mutation_rate: 0.1,
            topology_mutation_rate: 0.01,
            mutation_strength: 0.1,
            adaptive: false,
        }
    }
}

impl MutationPolicy {
    pub fn aggressive() -> Self {
        Self {
            weight_mutation_rate: 0.3,
            bias_mutation_rate: 0.3,
            topology_mutation_rate: 0.05,
            mutation_strength: 0.3,
            adaptive: true,
        }
    }
    
    pub fn conservative() -> Self {
        Self {
            weight_mutation_rate: 0.05,
            bias_mutation_rate: 0.05,
            topology_mutation_rate: 0.001,
            mutation_strength: 0.05,
            adaptive: false,
        }
    }
}

/// Mutate a neural DNA instance
pub fn mutate(dna: &mut NeuralDNA, policy: &MutationPolicy, mutation_type: &MutationType) {
    let mut rng = thread_rng();
    
    match mutation_type {
        MutationType::Weight => mutate_weights(dna, policy, &mut rng),
        MutationType::Bias => mutate_biases(dna, policy, &mut rng),
        MutationType::Topology => mutate_topology(dna, policy, &mut rng),
        MutationType::ActivationFunction => mutate_activation(dna, &mut rng),
        MutationType::Specialization => mutate_specialization(dna, policy, &mut rng),
        MutationType::All => {
            mutate_weights(dna, policy, &mut rng);
            mutate_biases(dna, policy, &mut rng);
            if rng.gen::<f32>() < policy.topology_mutation_rate {
                mutate_topology(dna, policy, &mut rng);
            }
        }
    }
    
    dna.generation += 1;
}

fn mutate_weights(dna: &mut NeuralDNA, policy: &MutationPolicy, rng: &mut impl Rng) {
    for weight in &mut dna.weights {
        if rng.gen::<f32>() < policy.weight_mutation_rate {
            let change = rng.gen_range(-policy.mutation_strength..policy.mutation_strength);
            *weight += change;
            *weight = weight.clamp(-5.0, 5.0); // Prevent extreme values
        }
    }
}

fn mutate_biases(dna: &mut NeuralDNA, policy: &MutationPolicy, rng: &mut impl Rng) {
    for bias in &mut dna.biases {
        if rng.gen::<f32>() < policy.bias_mutation_rate {
            let change = rng.gen_range(-policy.mutation_strength..policy.mutation_strength);
            *bias += change;
            *bias = bias.clamp(-5.0, 5.0); // Prevent extreme values
        }
    }
}

fn mutate_topology(dna: &mut NeuralDNA, _policy: &MutationPolicy, rng: &mut impl Rng) {
    // Simple topology mutation: adjust hidden layer sizes slightly
    for i in 1..dna.topology.len()-1 {
        if rng.gen::<f32>() < 0.1 {
            let change = rng.gen_range(-2..=2);
            let new_size = (dna.topology[i] as i32 + change).max(1) as usize;
            dna.topology[i] = new_size.min(100); // Cap at 100 neurons
        }
    }
}

fn mutate_activation(dna: &mut NeuralDNA, rng: &mut impl Rng) {
    let activations = ["sigmoid", "tanh", "relu", "leaky_relu"];
    dna.activation = activations[rng.gen_range(0..activations.len())].to_string();
}

fn mutate_specialization(dna: &mut NeuralDNA, policy: &MutationPolicy, rng: &mut impl Rng) {
    // Implement neurodivergent-inspired mutations
    if rng.gen::<f32>() < 0.1 {
        // Hyperfocus mutation: strengthen certain connections
        let start = rng.gen_range(0..dna.weights.len().saturating_sub(10));
        for i in start..start.min(start + 5).min(dna.weights.len()) {
            dna.weights[i] *= 1.0 + policy.mutation_strength;
        }
    }
}

/// Crossover between two parent DNA instances
pub fn crossover(parent1: &NeuralDNA, parent2: &NeuralDNA) -> Result<NeuralDNA, String> {
    if parent1.topology != parent2.topology {
        return Err("Parents must have same topology for crossover".to_string());
    }
    
    let mut rng = thread_rng();
    let mut child = parent1.clone();
    
    // Crossover weights
    for i in 0..child.weights.len() {
        if rng.gen::<bool>() {
            child.weights[i] = parent2.weights[i];
        }
    }
    
    // Crossover biases
    for i in 0..child.biases.len() {
        if rng.gen::<bool>() {
            child.biases[i] = parent2.biases[i];
        }
    }
    
    child.generation = parent1.generation.max(parent2.generation) + 1;
    child.fitness_scores.clear();
    
    Ok(child)
}
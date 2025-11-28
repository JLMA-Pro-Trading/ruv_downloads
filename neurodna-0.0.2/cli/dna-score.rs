use neurodna::*;
use std::env;

fn main() {
    println!("Neural DNA Scoring Tool v0.1.0");
    
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        println!("Usage: dna-score <dna_file> [benchmark_file]");
        println!("Example: dna-score organism.json");
        return;
    }
    
    let dna_file = &args[1];
    
    // Load DNA
    let dna_json = std::fs::read_to_string(dna_file)
        .expect("Failed to read DNA file");
    let dna = NeuralDNA::from_json(&dna_json)
        .expect("Failed to parse DNA");
    
    println!("Loaded DNA from: {}", dna_file);
    println!("Validation: {:?}", dna.validate());
    
    // Display DNA information
    println!("\n=== DNA Analysis ===");
    println!("Generation: {}", dna.generation);
    println!("Topology: {:?}", dna.topology);
    println!("Activation: {}", dna.activation);
    println!("Mutation Rate: {:.4}", dna.mutation_rate);
    println!("Weights: {}", dna.weights.len());
    println!("Biases: {}", dna.biases.len());
    
    // Calculate complexity metrics
    let total_connections = dna.weights.len();
    let total_neurons: usize = dna.topology.iter().sum();
    let hidden_layers = dna.topology.len() - 2;
    
    println!("\n=== Complexity Metrics ===");
    println!("Total neurons: {}", total_neurons);
    println!("Total connections: {}", total_connections);
    println!("Hidden layers: {}", hidden_layers);
    println!("Complexity score: {:.4}", total_connections as f32 / total_neurons as f32);
    
    // Fitness evaluation
    let scorer = StandardFitnessScorer::new();
    let fitness = scorer.evaluate(&dna);
    
    println!("\n=== Fitness Evaluation ===");
    println!("Overall fitness: {:.4}", fitness.overall);
    println!("Components:");
    for (name, value) in &fitness.components {
        println!("  {}: {:.4}", name, value);
    }
    
    // Historical fitness
    if !dna.fitness_scores.is_empty() {
        println!("\n=== Historical Fitness ===");
        println!("Average: {:.4}", dna.average_fitness());
        println!("Scores: {:?}", dna.fitness_scores);
    }
    
    // Weight statistics
    let weight_mean = dna.weights.iter().sum::<f32>() / dna.weights.len() as f32;
    let weight_std = {
        let variance = dna.weights.iter()
            .map(|w| (w - weight_mean).powi(2))
            .sum::<f32>() / dna.weights.len() as f32;
        variance.sqrt()
    };
    let weight_min = dna.weights.iter().cloned().fold(f32::INFINITY, f32::min);
    let weight_max = dna.weights.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    
    println!("\n=== Weight Statistics ===");
    println!("Mean: {:.4}", weight_mean);
    println!("Std Dev: {:.4}", weight_std);
    println!("Min: {:.4}", weight_min);
    println!("Max: {:.4}", weight_max);
    
    // Bias statistics
    if !dna.biases.is_empty() {
        let bias_mean = dna.biases.iter().sum::<f32>() / dna.biases.len() as f32;
        let bias_std = {
            let variance = dna.biases.iter()
                .map(|b| (b - bias_mean).powi(2))
                .sum::<f32>() / dna.biases.len() as f32;
            variance.sqrt()
        };
        
        println!("\n=== Bias Statistics ===");
        println!("Mean: {:.4}", bias_mean);
        println!("Std Dev: {:.4}", bias_std);
    }
    
    println!("\nScoring complete!");
}
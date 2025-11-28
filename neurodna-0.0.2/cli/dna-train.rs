use neurodna::*;
use std::env;

fn main() {
    println!("Neural DNA Training Tool v0.1.0");
    
    let args: Vec<String> = env::args().collect();
    if args.len() < 4 {
        println!("Usage: dna-train <topology> <activation> <generations>");
        println!("Example: dna-train 4,8,4,2 sigmoid 100");
        return;
    }
    
    // Parse topology
    let topology: Vec<usize> = args[1]
        .split(',')
        .map(|s| s.parse().expect("Invalid topology"))
        .collect();
    
    let activation = &args[2];
    let generations: usize = args[3].parse().expect("Invalid generations");
    
    println!("Training with topology: {:?}", topology);
    println!("Activation function: {}", activation);
    println!("Generations: {}", generations);
    
    // Create evolution engine
    let mut config = EvolutionConfig::default();
    config.max_generations = generations;
    config.population_size = 50;
    config.elite_count = 5;
    
    let mut engine = EvolutionEngine::new(config, topology, activation);
    let fitness_fn = StandardFitnessScorer::new();
    
    // Dummy training data
    let inputs = vec![vec![0.0, 1.0], vec![1.0, 0.0], vec![0.0, 0.0], vec![1.0, 1.0]];
    let targets = vec![vec![1.0], vec![1.0], vec![0.0], vec![0.0]];
    
    println!("Starting evolution...");
    
    // Run evolution
    for gen in 0..generations {
        engine.evolve_generation(&fitness_fn, &inputs, &targets);
        
        if gen % 10 == 0 {
            if let Some(stats) = engine.get_statistics() {
                println!("Generation {}: Best={:.4}, Avg={:.4}, Div={:.4}", 
                    gen, stats.best_fitness, stats.average_fitness, stats.diversity);
            }
        }
        
        if engine.should_stop() {
            println!("Evolution converged at generation {}", gen);
            break;
        }
    }
    
    // Save best individual
    if let Some(best) = engine.get_best_individual() {
        let json = best.dna.to_json().expect("Failed to serialize DNA");
        std::fs::write("best_dna.json", json).expect("Failed to write file");
        println!("Best DNA saved to best_dna.json");
        
        if let Some(fitness) = &best.fitness {
            println!("Final fitness: {:.4}", fitness.overall);
        }
    }
}
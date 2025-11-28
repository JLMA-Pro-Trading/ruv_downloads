use neurodna::*;
use std::env;

fn main() {
    println!("Neural DNA Spawning Tool v0.1.0");
    
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        println!("Usage: dna-spawn <parent_file> <offspring_count>");
        println!("Example: dna-spawn best_dna.json 5");
        return;
    }
    
    let parent_file = &args[1];
    let offspring_count: usize = args[2].parse().expect("Invalid offspring count");
    
    // Load parent DNA
    let parent_json = std::fs::read_to_string(parent_file)
        .expect("Failed to read parent file");
    let parent_dna = NeuralDNA::from_json(&parent_json)
        .expect("Failed to parse parent DNA");
    
    println!("Loaded parent DNA from: {}", parent_file);
    println!("Parent generation: {}", parent_dna.generation);
    println!("Parent fitness: {:.4}", parent_dna.average_fitness());
    
    // Create mutation policy
    let policy = MutationPolicy::default();
    
    println!("Spawning {} offspring...", offspring_count);
    
    // Generate offspring
    for i in 0..offspring_count {
        let mut offspring = parent_dna.clone();
        
        // Apply mutations
        mutate(&mut offspring, &policy, &MutationType::All);
        
        // Save offspring
        let filename = format!("offspring_{}.json", i + 1);
        let json = offspring.to_json().expect("Failed to serialize offspring");
        std::fs::write(&filename, json).expect("Failed to write offspring file");
        
        println!("Offspring {} saved to: {}", i + 1, filename);
        println!("  Generation: {}", offspring.generation);
        println!("  Topology: {:?}", offspring.topology);
    }
    
    println!("Spawning complete!");
}
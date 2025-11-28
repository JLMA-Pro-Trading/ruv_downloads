use neurodna::*;
use std::time::Instant;

fn main() {
    println!("🧬 Neural DNA Performance Demonstration\n");
    
    // Test different optimization levels
    let topology = vec![100, 200, 100, 50, 10];
    let population_size = 100;
    let generations = 10;
    
    println!("Configuration:");
    println!("  Topology: {:?}", topology);
    println!("  Population: {}", population_size);
    println!("  Generations: {}\n", generations);
    
    // Standard Evolution Engine
    println!("=== Standard Evolution Engine ===");
    let start = Instant::now();
    
    let config = EvolutionConfig {
        population_size,
        elite_count: population_size / 10,
        max_generations: generations,
        ..Default::default()
    };
    
    let mut standard_engine = EvolutionEngine::new(config.clone(), topology.clone(), "sigmoid");
    let scorer = StandardFitnessScorer::new();
    let inputs = vec![vec![0.0, 1.0], vec![1.0, 0.0], vec![0.0, 0.0], vec![1.0, 1.0]];
    let targets = vec![vec![1.0], vec![1.0], vec![0.0], vec![0.0]];
    
    for gen in 0..generations {
        standard_engine.evolve_generation(&scorer, &inputs, &targets);
        if gen % 2 == 0 {
            if let Some(stats) = standard_engine.get_statistics() {
                println!("  Gen {}: Best={:.4}, Avg={:.4}", gen, stats.best_fitness, stats.average_fitness);
            }
        }
    }
    
    let standard_time = start.elapsed();
    println!("Standard engine completed in: {:?}\n", standard_time);
    
    // Optimized Evolution Engine
    println!("=== Optimized Evolution Engine ===");
    let start = Instant::now();
    
    let mut optimized_engine = OptimizedEvolutionEngine::new(config.clone(), topology.clone(), "sigmoid");
    
    for gen in 0..generations {
        optimized_engine.evolve_generation_optimized(&scorer, &inputs, &targets);
        if gen % 2 == 0 {
            println!("  Gen {}: Processing...", gen);
        }
    }
    
    let optimized_time = start.elapsed();
    println!("Optimized engine completed in: {:?}", optimized_time);
    
    // Performance comparison
    let speedup = standard_time.as_millis() as f64 / optimized_time.as_millis() as f64;
    println!("\n=== Performance Results ===");
    println!("Standard time: {:?}", standard_time);
    println!("Optimized time: {:?}", optimized_time);
    println!("Speedup: {:.2}x", speedup);
    
    // Memory usage
    let memory_mb = optimized_engine.estimate_memory_usage();
    println!("Memory usage: {:.2} MB", memory_mb);
    
    // Cache performance
    let cache_ratio = optimized_engine.get_cache_hit_ratio();
    println!("Cache hit ratio: {:.2}%", cache_ratio * 100.0);
    
    // Performance metrics
    let metrics = optimized_engine.get_performance_metrics();
    println!("\n=== Detailed Metrics ===");
    println!("Total evaluations: {}", metrics.total_evaluations);
    println!("Cache hits: {}", metrics.cache_hits);
    println!("Cache misses: {}", metrics.cache_misses);
    println!("Avg generation time: {:.2} ms", metrics.avg_generation_time_ms);
    
    // SIMD Performance Test
    println!("\n=== SIMD Optimization Test ===");
    let mut weights = vec![0.5f32; 10000];
    let mutation_rate = 0.1;
    let strength = 0.1;
    let mut rng = rand::thread_rng();
    
    // Standard mutation
    let start = Instant::now();
    for _ in 0..1000 {
        for weight in &mut weights {
            if rand::random::<f32>() < mutation_rate {
                let change = rand::random::<f32>() * strength * 2.0 - strength;
                *weight = (*weight + change).clamp(-5.0, 5.0);
            }
        }
    }
    let standard_mutation_time = start.elapsed();
    
    // SIMD mutation
    let start = Instant::now();
    for _ in 0..1000 {
        simd::mutate_weights_fast(&mut weights, mutation_rate, strength, &mut rng);
    }
    let simd_mutation_time = start.elapsed();
    
    let mutation_speedup = standard_mutation_time.as_micros() as f64 / simd_mutation_time.as_micros() as f64;
    println!("Standard mutation: {:?}", standard_mutation_time);
    println!("SIMD mutation: {:?}", simd_mutation_time);
    println!("SIMD speedup: {:.2}x", mutation_speedup);
    
    // Memory Pool Test
    println!("\n=== Memory Pool Test ===");
    let pool_size = 100;
    let mut pool = memory::DNAPool::new(pool_size, topology.clone(), "sigmoid".to_string());
    
    let start = Instant::now();
    for _ in 0..1000 {
        if let Some(dna) = pool.get() {
            pool.return_dna(dna);
        }
    }
    let pool_time = start.elapsed();
    
    let start = Instant::now();
    for _ in 0..1000 {
        let _dna = NeuralDNA::random(topology.clone(), "sigmoid");
    }
    let direct_time = start.elapsed();
    
    let pool_speedup = direct_time.as_micros() as f64 / pool_time.as_micros() as f64;
    println!("Direct allocation: {:?}", direct_time);
    println!("Pool allocation: {:?}", pool_time);
    println!("Pool speedup: {:.2}x", pool_speedup);
    
    // Complexity Analysis
    println!("\n=== Complexity Analysis ===");
    let test_dna = NeuralDNA::random(topology.clone(), "sigmoid");
    
    let start = Instant::now();
    for _ in 0..10000 {
        let _complexity = test_dna.weights.len() as f64 * 0.001;
    }
    let simple_time = start.elapsed();
    
    let start = Instant::now();
    for _ in 0..10000 {
        let _complexity = simd::calculate_complexity_score_fast(&test_dna.weights, &test_dna.biases);
    }
    let simd_complexity_time = start.elapsed();
    
    println!("Simple complexity: {:?}", simple_time);
    println!("SIMD complexity: {:?}", simd_complexity_time);
    
    println!("\n🎯 Performance optimization complete!");
    println!("Overall speedup achieved: {:.2}x faster evolution", speedup);
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_performance_optimizations() {
        let topology = vec![10, 20, 10];
        let config = EvolutionConfig {
            population_size: 20,
            elite_count: 2,
            max_generations: 3,
            ..Default::default()
        };
        
        // Test both engines work
        let mut standard = EvolutionEngine::new(config.clone(), topology.clone(), "sigmoid");
        let mut optimized = OptimizedEvolutionEngine::new(config, topology, "sigmoid");
        let scorer = StandardFitnessScorer::new();
        let inputs = vec![vec![0.0, 1.0]];
        let targets = vec![vec![1.0]];
        
        // Both should complete without errors
        standard.evolve_generation(&scorer, &inputs, &targets);
        optimized.evolve_generation_optimized(&scorer, &inputs, &targets);
        
        // Check metrics are recorded
        let metrics = optimized.get_performance_metrics();
        assert!(metrics.total_evaluations > 0);
    }
}
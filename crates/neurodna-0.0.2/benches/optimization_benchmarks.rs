use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use neurodna::*;
use std::time::Duration;

// Benchmark optimized vs standard implementations
fn benchmark_optimized_vs_standard(c: &mut Criterion) {
    let mut group = c.benchmark_group("optimized_vs_standard");
    group.measurement_time(Duration::from_secs(10));
    
    let topology = vec![50, 100, 50, 25];
    let config = EvolutionConfig {
        population_size: 100,
        elite_count: 10,
        max_generations: 10,
        ..Default::default()
    };
    
    // Standard evolution engine
    group.bench_function("standard_evolution", |b| {
        b.iter_with_setup(
            || {
                let mut engine = EvolutionEngine::new(config.clone(), topology.clone(), "sigmoid");
                let scorer = StandardFitnessScorer::new();
                let inputs = vec![vec![0.0, 1.0], vec![1.0, 0.0]];
                let targets = vec![vec![1.0], vec![0.0]];
                (engine, scorer, inputs, targets)
            },
            |(mut engine, scorer, inputs, targets)| {
                engine.evolve_generation(black_box(&scorer), black_box(&inputs), black_box(&targets))
            },
        )
    });
    
    // Optimized evolution engine
    group.bench_function("optimized_evolution", |b| {
        b.iter_with_setup(
            || {
                let mut engine = OptimizedEvolutionEngine::new(config.clone(), topology.clone(), "sigmoid");
                let scorer = StandardFitnessScorer::new();
                let inputs = vec![vec![0.0, 1.0], vec![1.0, 0.0]];
                let targets = vec![vec![1.0], vec![0.0]];
                (engine, scorer, inputs, targets)
            },
            |(mut engine, scorer, inputs, targets)| {
                engine.evolve_generation_optimized(black_box(&scorer), black_box(&inputs), black_box(&targets))
            },
        )
    });
    
    group.finish();
}

// Benchmark SIMD optimizations
fn benchmark_simd_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_operations");
    
    let weights = vec![0.5f32; 10000]; // Large weight vector
    let mut test_weights = weights.clone();
    let mutation_rate = 0.1;
    let strength = 0.1;
    let mut rng = rand::thread_rng();
    
    group.throughput(Throughput::Elements(weights.len() as u64));
    
    // Standard mutation
    group.bench_function("standard_weight_mutation", |b| {
        b.iter_with_setup(
            || weights.clone(),
            |mut w| {
                for weight in &mut w {
                    if rand::random::<f32>() < mutation_rate {
                        let change = rand::random::<f32>() * strength * 2.0 - strength;
                        *weight = (*weight + change).clamp(-5.0, 5.0);
                    }
                }
                black_box(w)
            },
        )
    });
    
    // SIMD-optimized mutation
    group.bench_function("simd_weight_mutation", |b| {
        b.iter_with_setup(
            || weights.clone(),
            |mut w| {
                simd::mutate_weights_fast(&mut w, mutation_rate, strength, &mut rng);
                black_box(w)
            },
        )
    });
    
    group.finish();
}

// Benchmark memory optimizations
fn benchmark_memory_optimizations(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_optimizations");
    
    let topology = vec![20, 40, 20, 10];
    
    // Standard DNA creation
    group.bench_function("standard_dna_creation", |b| {
        b.iter(|| {
            NeuralDNA::random(black_box(topology.clone()), black_box("sigmoid"))
        })
    });
    
    // Optimized DNA creation
    group.bench_function("optimized_dna_creation", |b| {
        b.iter(|| {
            allocation::create_dna_optimized(black_box(topology.clone()), black_box("sigmoid"))
        })
    });
    
    // DNA pool reuse
    let mut pool = memory::DNAPool::new(100, topology.clone(), "sigmoid".to_string());
    group.bench_function("dna_pool_reuse", |b| {
        b.iter(|| {
            if let Some(dna) = pool.get() {
                pool.return_dna(black_box(dna));
            }
        })
    });
    
    group.finish();
}

// Benchmark caching effectiveness
fn benchmark_fitness_caching(c: &mut Criterion) {
    let mut group = c.benchmark_group("fitness_caching");
    
    let dna = NeuralDNA::random(vec![20, 40, 20, 10], "sigmoid");
    let scorer = StandardFitnessScorer::new();
    
    // Without caching
    group.bench_function("without_cache", |b| {
        b.iter(|| {
            scorer.evaluate(black_box(&dna))
        })
    });
    
    // With caching
    let mut cache = cache::FitnessCache::new(1000);
    group.bench_function("with_cache_miss", |b| {
        b.iter_with_setup(
            || {
                let test_dna = NeuralDNA::random(vec![20, 40, 20, 10], "sigmoid");
                test_dna
            },
            |test_dna| {
                if cache.get_fitness(&test_dna).is_none() {
                    let fitness = scorer.evaluate(&test_dna);
                    cache.store_fitness(&test_dna, fitness.overall);
                }
                black_box(test_dna)
            },
        )
    });
    
    // Cache hit (after storing)
    cache.store_fitness(&dna, 0.5);
    group.bench_function("with_cache_hit", |b| {
        b.iter(|| {
            cache.get_fitness(black_box(&dna))
        })
    });
    
    group.finish();
}

// Benchmark population size scaling
fn benchmark_population_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("population_scaling");
    
    let topology = vec![10, 20, 10, 5];
    let population_sizes = vec![50, 100, 200, 500];
    
    for pop_size in population_sizes {
        let config = EvolutionConfig {
            population_size: pop_size,
            elite_count: pop_size / 10,
            max_generations: 1,
            ..Default::default()
        };
        
        group.throughput(Throughput::Elements(pop_size as u64));
        
        // Standard engine scaling
        group.bench_with_input(
            BenchmarkId::new("standard", pop_size),
            &config,
            |b, cfg| {
                b.iter_with_setup(
                    || {
                        let mut engine = EvolutionEngine::new(cfg.clone(), topology.clone(), "sigmoid");
                        let scorer = StandardFitnessScorer::new();
                        let inputs = vec![vec![0.0, 1.0]];
                        let targets = vec![vec![1.0]];
                        (engine, scorer, inputs, targets)
                    },
                    |(mut engine, scorer, inputs, targets)| {
                        engine.evolve_generation(&scorer, &inputs, &targets)
                    },
                )
            },
        );
        
        // Optimized engine scaling
        group.bench_with_input(
            BenchmarkId::new("optimized", pop_size),
            &config,
            |b, cfg| {
                b.iter_with_setup(
                    || {
                        let mut engine = OptimizedEvolutionEngine::new(cfg.clone(), topology.clone(), "sigmoid");
                        let scorer = StandardFitnessScorer::new();
                        let inputs = vec![vec![0.0, 1.0]];
                        let targets = vec![vec![1.0]];
                        (engine, scorer, inputs, targets)
                    },
                    |(mut engine, scorer, inputs, targets)| {
                        engine.evolve_generation_optimized(&scorer, &inputs, &targets)
                    },
                )
            },
        );
    }
    
    group.finish();
}

// Benchmark complexity vs performance trade-offs
fn benchmark_complexity_tradeoffs(c: &mut Criterion) {
    let mut group = c.benchmark_group("complexity_tradeoffs");
    
    let topologies = vec![
        vec![4, 8, 2],           // Simple
        vec![20, 40, 20, 10],    // Medium
        vec![100, 200, 100, 50], // Complex
        vec![784, 256, 128, 10], // Large (MNIST-like)
    ];
    
    for topology in topologies {
        let complexity = topology.iter().sum::<usize>();
        let dna = NeuralDNA::random(topology.clone(), "sigmoid");
        let scorer = StandardFitnessScorer::new();
        
        group.throughput(Throughput::Elements(complexity as u64));
        group.bench_with_input(
            BenchmarkId::new("fitness_evaluation", complexity),
            &dna,
            |b, test_dna| {
                b.iter(|| {
                    scorer.evaluate(black_box(test_dna))
                })
            },
        );
        
        // SIMD complexity calculation
        group.bench_with_input(
            BenchmarkId::new("simd_complexity", complexity),
            &dna,
            |b, test_dna| {
                b.iter(|| {
                    simd::calculate_complexity_score_fast(black_box(&test_dna.weights), black_box(&test_dna.biases))
                })
            },
        );
    }
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_optimized_vs_standard,
    benchmark_simd_operations,
    benchmark_memory_optimizations,
    benchmark_fitness_caching,
    benchmark_population_scaling,
    benchmark_complexity_tradeoffs
);

criterion_main!(benches);
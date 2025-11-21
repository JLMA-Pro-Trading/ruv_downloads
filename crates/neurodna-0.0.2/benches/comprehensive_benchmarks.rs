use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use neurodna::*;
use std::time::Duration;

// Benchmark DNA creation across different topology sizes
fn benchmark_dna_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("dna_creation");
    
    let topologies = vec![
        vec![4, 8, 2],
        vec![10, 20, 10, 5],
        vec![100, 200, 100, 50, 10],
        vec![784, 128, 64, 10], // MNIST-like
    ];
    
    for topology in topologies {
        let param_string = format!("{:?}", topology);
        group.throughput(Throughput::Elements(1));
        group.bench_with_input(
            BenchmarkId::new("random", &param_string),
            &topology,
            |b, topo| {
                b.iter(|| {
                    NeuralDNA::random(black_box(topo.clone()), black_box("sigmoid"))
                })
            },
        );
        
        group.bench_with_input(
            BenchmarkId::new("structured", &param_string),
            &topology,
            |b, topo| {
                b.iter(|| {
                    NeuralDNA::new(black_box(topo.clone()), black_box("sigmoid"))
                })
            },
        );
    }
    group.finish();
}

// Benchmark mutation performance across different strategies
fn benchmark_mutations(c: &mut Criterion) {
    let mut group = c.benchmark_group("mutations");
    group.measurement_time(Duration::from_secs(10));
    
    let dna = NeuralDNA::random(vec![100, 200, 100, 50], "sigmoid");
    let policies = vec![
        ("conservative", MutationPolicy::conservative()),
        ("default", MutationPolicy::default()),
        ("aggressive", MutationPolicy::aggressive()),
    ];
    
    let mutation_types = vec![
        ("weight", MutationType::Weight),
        ("bias", MutationType::Bias),
        ("topology", MutationType::Topology),
        ("specialization", MutationType::Specialization),
        ("all", MutationType::All),
    ];
    
    for (policy_name, policy) in &policies {
        for (mut_name, mut_type) in &mutation_types {
            let param = format!("{}_{}", policy_name, mut_name);
            group.throughput(Throughput::Elements(1));
            group.bench_with_input(
                BenchmarkId::new("mutate", &param),
                &(policy, mut_type),
                |b, (pol, mt)| {
                    b.iter_with_setup(
                        || dna.clone(),
                        |mut test_dna| {
                            mutate(black_box(&mut test_dna), black_box(pol), black_box(mt))
                        },
                    )
                },
            );
        }
    }
    group.finish();
}

// Benchmark crossover operations
fn benchmark_crossover(c: &mut Criterion) {
    let mut group = c.benchmark_group("crossover");
    
    let topologies = vec![
        vec![10, 20, 10],
        vec![50, 100, 50, 25],
        vec![100, 200, 100, 50, 10],
    ];
    
    for topology in topologies {
        let parent1 = NeuralDNA::random(topology.clone(), "sigmoid");
        let parent2 = NeuralDNA::random(topology.clone(), "sigmoid");
        let param_string = format!("{:?}", topology);
        
        group.throughput(Throughput::Elements(1));
        group.bench_with_input(
            BenchmarkId::new("crossover", &param_string),
            &(&parent1, &parent2),
            |b, (p1, p2)| {
                b.iter(|| {
                    crossover(black_box(p1), black_box(p2))
                })
            },
        );
    }
    group.finish();
}

// Benchmark fitness evaluation
fn benchmark_fitness_evaluation(c: &mut Criterion) {
    let mut group = c.benchmark_group("fitness_evaluation");
    
    let dnas = vec![
        NeuralDNA::random(vec![4, 8, 2], "sigmoid"),
        NeuralDNA::random(vec![20, 40, 20, 10], "tanh"),
        NeuralDNA::random(vec![100, 200, 100, 50], "relu"),
        NeuralDNA::random(vec![784, 256, 128, 10], "sigmoid"), // Large network
    ];
    
    let scorer = StandardFitnessScorer::new();
    
    for (i, dna) in dnas.iter().enumerate() {
        let weights = dna.weights.len();
        group.throughput(Throughput::Elements(weights as u64));
        group.bench_with_input(
            BenchmarkId::new("evaluate", format!("weights_{}", weights)),
            dna,
            |b, test_dna| {
                b.iter(|| {
                    scorer.evaluate(black_box(test_dna))
                })
            },
        );
    }
    group.finish();
}

// Benchmark evolution engine performance
fn benchmark_evolution(c: &mut Criterion) {
    let mut group = c.benchmark_group("evolution");
    group.measurement_time(Duration::from_secs(15));
    group.sample_size(10);
    
    let population_sizes = vec![10, 50, 100, 250];
    let topology = vec![10, 20, 10, 5];
    
    for pop_size in population_sizes {
        let config = EvolutionConfig {
            population_size: pop_size,
            elite_count: pop_size / 10,
            max_generations: 10,
            ..Default::default()
        };
        
        group.throughput(Throughput::Elements(pop_size as u64));
        group.bench_with_input(
            BenchmarkId::new("evolve_generation", pop_size),
            &config,
            |b, cfg| {
                b.iter_with_setup(
                    || {
                        let mut engine = EvolutionEngine::new(cfg.clone(), topology.clone(), "sigmoid");
                        let scorer = StandardFitnessScorer::new();
                        let inputs = vec![vec![0.0, 1.0], vec![1.0, 0.0]];
                        let targets = vec![vec![1.0], vec![0.0]];
                        (engine, scorer, inputs, targets)
                    },
                    |(mut engine, scorer, inputs, targets)| {
                        engine.evolve_generation(black_box(&scorer), black_box(&inputs), black_box(&targets))
                    },
                )
            },
        );
    }
    group.finish();
}

// Benchmark serialization performance
fn benchmark_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("serialization");
    
    let dnas = vec![
        NeuralDNA::random(vec![10, 20, 10], "sigmoid"),
        NeuralDNA::random(vec![100, 200, 100], "tanh"),
        NeuralDNA::random(vec![500, 1000, 500], "relu"),
    ];
    
    for (i, dna) in dnas.iter().enumerate() {
        let size = dna.weights.len() + dna.biases.len();
        group.throughput(Throughput::Bytes(size as u64 * 4)); // 4 bytes per f32
        
        group.bench_with_input(
            BenchmarkId::new("to_json", format!("size_{}", size)),
            dna,
            |b, test_dna| {
                b.iter(|| {
                    test_dna.to_json()
                })
            },
        );
        
        let json = dna.to_json().unwrap();
        group.bench_with_input(
            BenchmarkId::new("from_json", format!("size_{}", size)),
            &json,
            |b, test_json| {
                b.iter(|| {
                    NeuralDNA::from_json(black_box(test_json))
                })
            },
        );
    }
    group.finish();
}

// Benchmark trait system performance
fn benchmark_traits(c: &mut Criterion) {
    let mut group = c.benchmark_group("traits");
    
    group.bench_function("adhd_profile_creation", |b| {
        b.iter(|| {
            TraitProfile::adhd_profile()
        })
    });
    
    group.bench_function("autism_profile_creation", |b| {
        b.iter(|| {
            TraitProfile::autism_profile()
        })
    });
    
    let profile = TraitProfile::adhd_profile();
    group.bench_function("trait_lookup", |b| {
        b.iter(|| {
            profile.get_trait(black_box("hyperfocus"))
        })
    });
    
    group.finish();
}

// Memory usage benchmark
fn benchmark_memory_usage(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_usage");
    
    let population_sizes = vec![100, 500, 1000, 2000];
    let topology = vec![50, 100, 50, 25];
    
    for pop_size in population_sizes {
        group.bench_with_input(
            BenchmarkId::new("population_creation", pop_size),
            &pop_size,
            |b, &size| {
                b.iter(|| {
                    let population: Vec<NeuralDNA> = (0..size)
                        .map(|_| NeuralDNA::random(topology.clone(), "sigmoid"))
                        .collect();
                    black_box(population)
                })
            },
        );
    }
    group.finish();
}

// Parallel processing benchmark (for future optimization)
fn benchmark_parallel_potential(c: &mut Criterion) {
    let mut group = c.benchmark_group("parallel_potential");
    
    let population: Vec<NeuralDNA> = (0..100)
        .map(|_| NeuralDNA::random(vec![20, 40, 20, 10], "sigmoid"))
        .collect();
    
    let scorer = StandardFitnessScorer::new();
    
    group.bench_function("sequential_fitness", |b| {
        b.iter(|| {
            let scores: Vec<_> = population.iter()
                .map(|dna| scorer.evaluate(black_box(dna)))
                .collect();
            black_box(scores)
        })
    });
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_dna_creation,
    benchmark_mutations,
    benchmark_crossover,
    benchmark_fitness_evaluation,
    benchmark_evolution,
    benchmark_serialization,
    benchmark_traits,
    benchmark_memory_usage,
    benchmark_parallel_potential
);

criterion_main!(benches);
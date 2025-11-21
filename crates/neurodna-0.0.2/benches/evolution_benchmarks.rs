use criterion::{black_box, criterion_group, criterion_main, Criterion};
use neurodna::*;

fn benchmark_dna_creation(c: &mut Criterion) {
    c.bench_function("dna_creation", |b| {
        b.iter(|| {
            let topology = vec![4, 8, 4, 2];
            NeuralDNA::random(black_box(topology), black_box("sigmoid"))
        })
    });
}

fn benchmark_mutation(c: &mut Criterion) {
    let mut dna = NeuralDNA::random(vec![4, 8, 4, 2], "sigmoid");
    let policy = MutationPolicy::default();
    
    c.bench_function("mutation", |b| {
        b.iter(|| {
            mutation::mutate(black_box(&mut dna), black_box(&policy), black_box(&MutationType::Weight))
        })
    });
}

fn benchmark_fitness_evaluation(c: &mut Criterion) {
    let dna = NeuralDNA::random(vec![4, 8, 4, 2], "sigmoid");
    let scorer = fitness::StandardFitnessScorer::new();
    
    c.bench_function("fitness_evaluation", |b| {
        b.iter(|| {
            scorer.evaluate(black_box(&dna))
        })
    });
}

criterion_group!(benches, benchmark_dna_creation, benchmark_mutation, benchmark_fitness_evaluation);
criterion_main!(benches);
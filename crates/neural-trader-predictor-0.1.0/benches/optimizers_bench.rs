use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use neural_trader_predictor::optimizers::{
    NanosecondScheduler, SublinearUpdater, TemporalLeadSolver, StrangeLoopOptimizer,
};
use std::time::Duration;

// ============================================================================
// SCHEDULER BENCHMARKS
// ============================================================================

fn bench_scheduler_creation(c: &mut Criterion) {
    c.bench_function("scheduler_creation", |b| {
        b.iter(|| {
            let _scheduler = NanosecondScheduler::new().unwrap();
        })
    });
}

fn bench_scheduler_schedule(c: &mut Criterion) {
    let scheduler = NanosecondScheduler::new().unwrap();

    c.bench_function("scheduler_single_schedule", |b| {
        b.iter(|| {
            scheduler.schedule_calibration_update(
                black_box(1000),
                black_box(128),
                black_box(10000),
            ).unwrap()
        })
    });
}

fn bench_scheduler_schedule_batch(c: &mut Criterion) {
    let mut group = c.benchmark_group("scheduler_batch_schedule");
    group.sample_size(10);

    for task_count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*task_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(task_count),
            task_count,
            |b, &task_count| {
                let scheduler = NanosecondScheduler::new().unwrap();
                b.iter(|| {
                    for i in 0..task_count {
                        scheduler
                            .schedule_calibration_update(
                                black_box(1000 + i as u64),
                                black_box((i % 256) as u8),
                                black_box(10000),
                            )
                            .unwrap();
                    }
                })
            },
        );
    }
    group.finish();
}

fn bench_scheduler_execute(c: &mut Criterion) {
    let scheduler = NanosecondScheduler::new().unwrap();

    // Pre-populate with tasks
    for i in 0..100 {
        scheduler
            .schedule_calibration_update(
                1000 + i * 100,
                (i % 256) as u8,
                10000,
            )
            .unwrap();
    }

    std::thread::sleep(Duration::from_micros(2000));

    c.bench_function("scheduler_execute_pending", |b| {
        b.iter(|| {
            scheduler.execute_pending().unwrap()
        })
    });
}

// ============================================================================
// SUBLINEAR UPDATER BENCHMARKS
// ============================================================================

fn bench_sublinear_creation(c: &mut Criterion) {
    c.bench_function("sublinear_creation", |b| {
        b.iter(|| {
            let _updater = SublinearUpdater::new().unwrap();
        })
    });
}

fn bench_sublinear_single_insert(c: &mut Criterion) {
    let updater = SublinearUpdater::new().unwrap();

    c.bench_function("sublinear_single_insert", |b| {
        b.iter(|| {
            updater.insert_score(black_box(5.5)).unwrap()
        })
    });
}

fn bench_sublinear_sorted_inserts(c: &mut Criterion) {
    let mut group = c.benchmark_group("sublinear_sorted_inserts");
    group.sample_size(10);

    for insert_count in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*insert_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(insert_count),
            insert_count,
            |b, &insert_count| {
                b.iter_batched(
                    || {
                        let updater = SublinearUpdater::new().unwrap();
                        let mut scores = Vec::with_capacity(insert_count);
                        for i in 0..insert_count {
                            scores.push((i as f64) * 0.1);
                        }
                        (updater, scores)
                    },
                    |(updater, scores)| {
                        for score in scores {
                            updater.insert_score(black_box(score)).unwrap();
                        }
                    },
                    criterion::BatchSize::SmallInput,
                )
            },
        );
    }
    group.finish();
}

fn bench_sublinear_random_inserts(c: &mut Criterion) {
    let mut group = c.benchmark_group("sublinear_random_inserts");
    group.sample_size(10);

    for insert_count in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*insert_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(insert_count),
            insert_count,
            |b, &insert_count| {
                b.iter_batched(
                    || {
                        let updater = SublinearUpdater::new().unwrap();
                        let mut scores = Vec::with_capacity(insert_count);
                        for i in 0..insert_count {
                            scores.push(((i as f64 * 7919.0) % 10000.0) / 100.0);
                        }
                        (updater, scores)
                    },
                    |(updater, scores)| {
                        for score in scores {
                            updater.insert_score(black_box(score)).unwrap();
                        }
                    },
                    criterion::BatchSize::SmallInput,
                )
            },
        );
    }
    group.finish();
}

fn bench_sublinear_quantile(c: &mut Criterion) {
    let updater = SublinearUpdater::new().unwrap();

    // Pre-populate with 1000 sorted scores
    for i in 0..1000 {
        updater.insert_score(i as f64).unwrap();
    }

    c.bench_function("sublinear_quantile", |b| {
        b.iter(|| {
            updater.quantile(black_box(0.95)).unwrap()
        })
    });
}

fn bench_sublinear_batch_quantiles(c: &mut Criterion) {
    let updater = SublinearUpdater::new().unwrap();

    // Pre-populate with 1000 sorted scores
    for i in 0..1000 {
        updater.insert_score(i as f64).unwrap();
    }

    let percentiles = vec![
        black_box(0.25),
        black_box(0.50),
        black_box(0.75),
        black_box(0.95),
        black_box(0.99),
    ];

    c.bench_function("sublinear_batch_quantiles", |b| {
        b.iter(|| {
            updater.quantiles(&percentiles).unwrap()
        })
    });
}

// ============================================================================
// TEMPORAL LEAD SOLVER BENCHMARKS
// ============================================================================

fn bench_temporal_creation(c: &mut Criterion) {
    c.bench_function("temporal_creation", |b| {
        b.iter(|| {
            let _solver = TemporalLeadSolver::new(black_box(100)).unwrap();
        })
    });
}

fn bench_temporal_precompute(c: &mut Criterion) {
    let mut group = c.benchmark_group("temporal_precompute");
    group.sample_size(10);

    for prediction_count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*prediction_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(prediction_count),
            prediction_count,
            |b, &prediction_count| {
                let solver = TemporalLeadSolver::new(100).unwrap();
                let base_values: Vec<_> = (0..prediction_count)
                    .map(|i| 100.0 + (i as f64) * 0.1)
                    .collect();
                let ranges: Vec<_> = (0..prediction_count)
                    .map(|i| (95.0 + (i as f64) * 0.1, 105.0 + (i as f64) * 0.1))
                    .collect();

                b.iter(|| {
                    solver
                        .precompute_predictions(
                            black_box(base_values.clone()),
                            black_box(ranges.clone()),
                            black_box(5000),
                        )
                        .unwrap()
                })
            },
        );
    }
    group.finish();
}

fn bench_temporal_get_prediction(c: &mut Criterion) {
    let solver = TemporalLeadSolver::new(100).unwrap();

    // Pre-compute some predictions
    let base_values = vec![100.0, 102.0, 98.0];
    let ranges = vec![(95.0, 105.0), (100.0, 105.0), (95.0, 100.0)];
    solver
        .precompute_predictions(base_values, ranges, 5000)
        .unwrap();

    c.bench_function("temporal_get_prediction", |b| {
        b.iter(|| {
            solver
                .get_prediction(black_box("pred_95_105"), black_box(0.0))
                .unwrap()
        })
    });
}

fn bench_temporal_cache_hit_rate(c: &mut Criterion) {
    let solver = TemporalLeadSolver::new(100).unwrap();

    // Pre-compute predictions
    let base_values: Vec<_> = (0..100).map(|i| 100.0 + (i as f64) * 0.1).collect();
    let ranges: Vec<_> = (0..100)
        .map(|i| (95.0 + (i as f64) * 0.1, 105.0 + (i as f64) * 0.1))
        .collect();
    solver
        .precompute_predictions(base_values, ranges, 5000)
        .unwrap();

    // Perform queries
    let mut group = c.benchmark_group("temporal_cache_hit_rate");
    group.sample_size(10);

    group.bench_function("100_hits_10_misses", |b| {
        b.iter(|| {
            for i in 0..100 {
                solver
                    .get_prediction(
                        black_box(&format!("pred_{:.1}_{:.1}", 95.0 + i as f64 * 0.1, 105.0 + i as f64 * 0.1)),
                        black_box(0.0),
                    )
                    .unwrap();
            }

            for i in 0..10 {
                solver
                    .get_prediction(black_box(&format!("miss_{}", i)), black_box(0.0))
                    .unwrap();
            }
        })
    });

    group.finish();
}

// ============================================================================
// STRANGE LOOP OPTIMIZER BENCHMARKS
// ============================================================================

fn bench_loop_optimizer_creation(c: &mut Criterion) {
    c.bench_function("loop_optimizer_creation", |b| {
        b.iter(|| {
            let _optimizer = StrangeLoopOptimizer::new().unwrap();
        })
    });
}

fn bench_loop_optimizer_step(c: &mut Criterion) {
    let optimizer = StrangeLoopOptimizer::new().unwrap();

    c.bench_function("loop_optimizer_single_step", |b| {
        b.iter(|| {
            optimizer
                .optimize_step(black_box(0.87), black_box(10.5), black_box(1))
                .unwrap()
        })
    });
}

fn bench_loop_optimizer_convergence(c: &mut Criterion) {
    let mut group = c.benchmark_group("loop_optimizer_convergence");
    group.sample_size(10);

    for iteration_count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*iteration_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(iteration_count),
            iteration_count,
            |b, &iteration_count| {
                let optimizer = StrangeLoopOptimizer::new().unwrap();
                b.iter(|| {
                    for i in 1..=iteration_count {
                        let coverage = 0.90 - (0.05 * ((i as f64 - 1.0) / iteration_count as f64).sin()).abs();
                        optimizer
                            .optimize_step(black_box(coverage), black_box(10.0), black_box(i as u64))
                            .unwrap();
                    }
                })
            },
        );
    }
    group.finish();
}

fn bench_loop_optimizer_metrics(c: &mut Criterion) {
    let optimizer = StrangeLoopOptimizer::new().unwrap();

    // Run optimization
    for i in 1..=100 {
        let coverage = 0.90 - (0.05 * ((i as f64 - 1.0) / 100.0).sin()).abs();
        optimizer
            .optimize_step(coverage, 10.0, i as u64)
            .unwrap();
    }

    c.bench_function("loop_optimizer_convergence_metrics", |b| {
        b.iter(|| {
            optimizer.convergence_metrics().unwrap()
        })
    });
}

// ============================================================================
// INTEGRATED BENCHMARKS
// ============================================================================

fn bench_integrated_workflow(c: &mut Criterion) {
    let mut group = c.benchmark_group("integrated_workflow");
    group.sample_size(5);
    group.measurement_time(Duration::from_secs(10));

    group.bench_function("full_optimization_cycle", |b| {
        b.iter(|| {
            // Create all optimizers
            let scheduler = NanosecondScheduler::new().unwrap();
            let updater = SublinearUpdater::new().unwrap();
            let temporal = TemporalLeadSolver::new(100).unwrap();
            let strange_loop = StrangeLoopOptimizer::new().unwrap();

            // Scheduler: schedule 50 calibration updates
            for i in 0..50 {
                scheduler
                    .schedule_calibration_update(1000 + i * 100, (i % 256) as u8, 10000)
                    .unwrap();
            }

            // Sublinear: insert 100 sorted scores
            for i in 0..100 {
                updater.insert_score(i as f64).unwrap();
            }

            // Temporal: precompute 20 predictions
            let base_values: Vec<_> = (0..20).map(|i| 100.0 + (i as f64) * 0.5).collect();
            let ranges: Vec<_> = (0..20)
                .map(|i| (95.0 + (i as f64) * 0.5, 105.0 + (i as f64) * 0.5))
                .collect();
            temporal
                .precompute_predictions(base_values, ranges, 5000)
                .unwrap();

            // Strange Loop: run 20 optimization steps
            for i in 1..=20 {
                let coverage = 0.90 - (0.02 * ((i as f64 - 1.0) / 20.0).sin()).abs();
                strange_loop
                    .optimize_step(coverage, 10.0, i as u64)
                    .unwrap();
            }

            // Verify results
            let _scheduler_stats = scheduler.stats();
            let _updater_stats = updater.stats().unwrap();
            let _temporal_stats = temporal.stats().unwrap();
            let _loop_metrics = strange_loop.convergence_metrics().unwrap();
        })
    });

    group.finish();
}

// ============================================================================
// CRITERION GROUP SETUP
// ============================================================================

criterion_group!(
    name = scheduler_benches;
    config = Criterion::default();
    targets = bench_scheduler_creation,
             bench_scheduler_schedule,
             bench_scheduler_schedule_batch,
             bench_scheduler_execute
);

criterion_group!(
    name = sublinear_benches;
    config = Criterion::default();
    targets = bench_sublinear_creation,
             bench_sublinear_single_insert,
             bench_sublinear_sorted_inserts,
             bench_sublinear_random_inserts,
             bench_sublinear_quantile,
             bench_sublinear_batch_quantiles
);

criterion_group!(
    name = temporal_benches;
    config = Criterion::default();
    targets = bench_temporal_creation,
             bench_temporal_precompute,
             bench_temporal_get_prediction,
             bench_temporal_cache_hit_rate
);

criterion_group!(
    name = loop_benches;
    config = Criterion::default();
    targets = bench_loop_optimizer_creation,
             bench_loop_optimizer_step,
             bench_loop_optimizer_convergence,
             bench_loop_optimizer_metrics
);

criterion_group!(
    name = integrated_benches;
    config = Criterion::default().sample_size(5);
    targets = bench_integrated_workflow
);

criterion_main!(
    scheduler_benches,
    sublinear_benches,
    temporal_benches,
    loop_benches,
    integrated_benches
);

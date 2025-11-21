//! Memory system benchmarks
//!
//! Performance targets:
//! - L1 cache: <1μs lookup
//! - Vector search: <1ms (p95)
//! - Position lookup: <100ns (p99)
//! - Cross-agent latency: <5ms

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use nt_memory::*;
use std::time::Duration;

// ============================================================================
// L1 Cache Benchmarks
// ============================================================================

fn bench_l1_cache_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("l1_cache");

    let cache = HotCache::new(CacheConfig::default());

    // Insert benchmark
    group.bench_function("insert", |b| {
        let mut counter = 0;
        b.iter(|| {
            let key = format!("key_{}", counter);
            cache.insert(black_box(&key), black_box(vec![1, 2, 3, 4]));
            counter += 1;
        });
    });

    // Populate cache
    for i in 0..1000 {
        cache.insert(&format!("key_{}", i), vec![1; 100]);
    }

    // Lookup benchmark (should be <1μs)
    group.bench_function("get_hit", |b| {
        b.iter(|| {
            let entry = cache.get(black_box("key_500"));
            black_box(entry);
        });
    });

    group.bench_function("get_miss", |b| {
        b.iter(|| {
            let entry = cache.get(black_box("nonexistent"));
            black_box(entry);
        });
    });

    group.finish();
}

fn bench_l1_cache_concurrent(c: &mut Criterion) {
    let mut group = c.benchmark_group("l1_cache_concurrent");

    let rt = tokio::runtime::Runtime::new().unwrap();

    group.bench_function("parallel_inserts", |b| {
        b.to_async(&rt).iter(|| async {
            let cache = std::sync::Arc::new(HotCache::new(CacheConfig::default()));

            let handles: Vec<_> = (0..10)
                .map(|i| {
                    let cache = cache.clone();
                    tokio::spawn(async move {
                        for j in 0..100 {
                            let key = format!("agent_{}_key_{}", i, j);
                            cache.insert(&key, vec![i as u8; 100]);
                        }
                    })
                })
                .collect();

            for handle in handles {
                handle.await.unwrap();
            }

            black_box(cache.len())
        });
    });

    group.finish();
}

// ============================================================================
// Trajectory Tracking Benchmarks
// ============================================================================

fn bench_trajectory_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("trajectory");

    let rt = tokio::runtime::Runtime::new().unwrap();

    group.bench_function("create_and_track", |b| {
        b.to_async(&rt).iter(|| async {
            let tracker = TrajectoryTracker::new();

            let mut trajectory = Trajectory::new("agent_1".to_string());

            trajectory.add_observation(
                serde_json::json!({"price": 100.0}),
                Some(vec![0.1; 384]),
            );

            trajectory.add_action(
                "buy".to_string(),
                serde_json::json!({"quantity": 10}),
                Some(110.0),
            );

            trajectory.add_outcome(105.0);

            tracker.track(trajectory).await.unwrap();

            black_box(tracker.count())
        });
    });

    group.finish();
}

fn bench_verdict_judgment(c: &mut Criterion) {
    let mut group = c.benchmark_group("verdict");

    // Create test trajectories
    let mut trajectories = Vec::new();

    for i in 0..100 {
        let mut trajectory = Trajectory::new(format!("agent_{}", i));

        trajectory.add_action(
            "trade".to_string(),
            serde_json::json!({}),
            Some(100.0),
        );

        trajectory.add_outcome(100.0 + (i as f64 * 0.1));

        trajectories.push(trajectory);
    }

    let judge = VerdictJudge::new();

    group.throughput(Throughput::Elements(100));

    group.bench_function("judge_batch_100", |b| {
        b.iter(|| {
            let results = judge.judge_batch(black_box(&trajectories));
            black_box(results)
        });
    });

    group.finish();
}

// ============================================================================
// Memory Distillation Benchmarks
// ============================================================================

fn bench_memory_distillation(c: &mut Criterion) {
    let mut group = c.benchmark_group("distillation");
    group.sample_size(30);

    let rt = tokio::runtime::Runtime::new().unwrap();

    for size in [10, 50, 100].iter() {
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.to_async(&rt).iter(|| async {
                let distiller = MemoryDistiller::new(false);

                // Create trajectories
                let mut trajectories = Vec::new();

                for i in 0..size {
                    let mut trajectory = Trajectory::new("agent_1".to_string());

                    let embedding = vec![0.5 + (i as f32 * 0.01); 384];
                    trajectory.add_observation(serde_json::json!({"i": i}), Some(embedding));

                    trajectories.push(trajectory);
                }

                let patterns = distiller.distill(&trajectories).await;

                black_box(patterns)
            });
        });
    }

    group.finish();
}

// ============================================================================
// Pub/Sub Benchmarks
// ============================================================================

fn bench_pubsub_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("pubsub");

    let rt = tokio::runtime::Runtime::new().unwrap();

    group.bench_function("subscribe", |b| {
        b.to_async(&rt).iter(|| async {
            let broker = PubSubBroker::new();
            let _rx = broker.subscribe("test_topic").await.unwrap();
            black_box(())
        });
    });

    group.bench_function("publish_single", |b| {
        b.to_async(&rt).iter(|| async {
            let broker = PubSubBroker::new();
            let _rx = broker.subscribe("topic").await.unwrap();

            broker.publish("topic", vec![1, 2, 3, 4]).await.unwrap();

            black_box(())
        });
    });

    group.bench_function("publish_broadcast_10", |b| {
        b.to_async(&rt).iter(|| async {
            let broker = PubSubBroker::new();

            // 10 subscribers
            let mut receivers = Vec::new();
            for _ in 0..10 {
                receivers.push(broker.subscribe("topic").await.unwrap());
            }

            broker.publish("topic", vec![1, 2, 3, 4]).await.unwrap();

            black_box(())
        });
    });

    group.finish();
}

// ============================================================================
// Distributed Lock Benchmarks
// ============================================================================

fn bench_distributed_locks(c: &mut Criterion) {
    let mut group = c.benchmark_group("distributed_locks");

    let rt = tokio::runtime::Runtime::new().unwrap();

    group.bench_function("acquire_release", |b| {
        b.to_async(&rt).iter(|| async {
            let locks = DistributedLock::new();

            let token = locks
                .acquire("resource", Duration::from_secs(1))
                .await
                .unwrap();

            locks.release(&token).await.unwrap();

            black_box(())
        });
    });

    group.bench_function("contention_10_agents", |b| {
        b.to_async(&rt).iter(|| async {
            let locks = std::sync::Arc::new(DistributedLock::new());

            let handles: Vec<_> = (0..10)
                .map(|i| {
                    let locks = locks.clone();
                    tokio::spawn(async move {
                        let token = locks
                            .acquire("shared_resource", Duration::from_millis(100))
                            .await;

                        if let Ok(token) = token {
                            // Hold lock briefly
                            tokio::time::sleep(Duration::from_micros(100)).await;
                            locks.release(&token).await.unwrap();
                        }

                        i
                    })
                })
                .collect();

            for handle in handles {
                handle.await.unwrap();
            }

            black_box(())
        });
    });

    group.finish();
}

// ============================================================================
// Consensus Benchmarks
// ============================================================================

fn bench_consensus_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("consensus");

    let rt = tokio::runtime::Runtime::new().unwrap();

    group.bench_function("proposal_voting_3_agents", |b| {
        b.to_async(&rt).iter(|| async {
            let engine = ConsensusEngine::new();

            // Register agents
            for i in 1..=3 {
                engine.register_agent(format!("agent{}", i), 1.0).await;
            }

            // Submit proposal
            let proposal = Proposal {
                id: String::new(),
                proposer: "agent1".to_string(),
                data: serde_json::json!({"action": "test"}),
                quorum: 0.67,
            };

            let proposal_id = engine.submit_proposal(proposal).await;

            // Vote
            for i in 1..=3 {
                engine
                    .vote(Vote {
                        proposal_id: proposal_id.clone(),
                        voter: format!("agent{}", i),
                        approve: true,
                        weight: 1.0,
                    })
                    .await
                    .ok();
            }

            black_box(())
        });
    });

    group.finish();
}

// ============================================================================
// Namespace Operations Benchmarks
// ============================================================================

fn bench_namespace_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("namespace");

    group.bench_function("parse", |b| {
        b.iter(|| {
            let result = Namespace::parse(black_box("swarm/agent_1/position"));
            black_box(result)
        });
    });

    group.bench_function("build", |b| {
        b.iter(|| {
            let key = Namespace::build(black_box("agent_1"), black_box("position"));
            black_box(key)
        });
    });

    group.bench_function("validate", |b| {
        b.iter(|| {
            let valid = Namespace::validate(black_box("swarm/agent_1/key"));
            black_box(valid)
        });
    });

    group.finish();
}

// ============================================================================
// Benchmark Configuration
// ============================================================================

fn configure_criterion() -> Criterion {
    Criterion::default()
        .sample_size(100)
        .measurement_time(Duration::from_secs(5))
        .warm_up_time(Duration::from_secs(2))
        .configure_from_args()
}

criterion_group! {
    name = benches;
    config = configure_criterion();
    targets =
        bench_l1_cache_operations,
        bench_l1_cache_concurrent,
        bench_trajectory_operations,
        bench_verdict_judgment,
        bench_memory_distillation,
        bench_pubsub_operations,
        bench_distributed_locks,
        bench_consensus_operations,
        bench_namespace_operations
}

criterion_main!(benches);

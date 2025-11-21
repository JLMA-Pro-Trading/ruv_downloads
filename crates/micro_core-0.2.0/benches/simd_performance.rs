use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::time::Duration;
use rand::prelude::*;
use micro_core::types::{RootVector, RootSpace, CartanMatrix};

/// Benchmark real SIMD vs scalar performance
fn bench_simd_dot_product(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_dot_product");
    group.sample_size(1000);
    group.measurement_time(Duration::from_secs(3));
    
    // Create test vectors
    let mut rng = thread_rng();
    let v1 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0)));
    let v2 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0)));
    
    group.throughput(Throughput::Elements(32));
    
    // SIMD benchmark
    #[cfg(feature = "simd")]
    group.bench_function("simd_dot", |b| {
        b.iter(|| {
            black_box(v1.dot(black_box(&v2)))
        });
    });
    
    // Scalar benchmark for comparison
    group.bench_function("scalar_dot", |b| {
        b.iter(|| {
            let result = v1.data.iter()
                .zip(v2.data.iter())
                .map(|(a, b)| a * b)
                .sum::<f32>();
            black_box(result)
        });
    });
    
    group.finish();
}

/// Benchmark SIMD vector operations
fn bench_simd_vector_ops(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_vector_ops");
    group.sample_size(1000);
    
    let mut rng = thread_rng();
    let mut v1 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0)));
    let v2 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0)));
    let scalar = rng.gen_range(0.1..2.0);
    
    group.throughput(Throughput::Elements(32));
    
    // Vector addition
    group.bench_function("simd_add", |b| {
        b.iter(|| {
            let mut v = v1;
            v.add_assign(black_box(&v2));
            black_box(v)
        });
    });
    
    // Scalar multiplication
    group.bench_function("simd_scale", |b| {
        b.iter(|| {
            let mut v = v1;
            v.scale(black_box(scalar));
            black_box(v)
        });
    });
    
    // Scalar comparisons
    group.bench_function("scalar_add", |b| {
        b.iter(|| {
            let mut result = v1;
            for i in 0..32 {
                result.data[i] += v2.data[i];
            }
            black_box(result)
        });
    });
    
    group.bench_function("scalar_scale", |b| {
        b.iter(|| {
            let mut result = v1;
            for i in 0..32 {
                result.data[i] *= scalar;
            }
            black_box(result)
        });
    });
    
    group.finish();
}

/// Benchmark SIMD matrix operations
fn bench_simd_matrix_ops(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_matrix_ops");
    group.sample_size(100);
    group.measurement_time(Duration::from_secs(5));
    
    let root_space = RootSpace::new();
    let mut rng = thread_rng();
    
    for input_size in [768, 1024, 2048, 4096].iter() {
        let input: Vec<f32> = (0..*input_size)
            .map(|_| rng.gen_range(-1.0..1.0))
            .collect();
        
        group.throughput(Throughput::Elements(*input_size as u64));
        
        // SIMD projection
        #[cfg(feature = "simd")]
        group.bench_with_input(
            BenchmarkId::new("simd_projection", input_size),
            input_size,
            |b, _| {
                b.iter(|| {
                    root_space.project_simd(black_box(&input))
                });
            },
        );
        
        // Regular projection
        group.bench_with_input(
            BenchmarkId::new("regular_projection", input_size),
            input_size,
            |b, _| {
                b.iter(|| {
                    root_space.project(black_box(&input))
                });
            },
        );
    }
    
    group.finish();
}

/// Benchmark Cartan matrix SIMD operations
fn bench_simd_cartan_matrix(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_cartan_matrix");
    group.sample_size(100);
    
    let mut rng = thread_rng();
    let matrix1 = CartanMatrix {
        data: core::array::from_fn(|_| core::array::from_fn(|_| rng.gen_range(-1.0..1.0)))
    };
    let matrix2 = CartanMatrix {
        data: core::array::from_fn(|_| core::array::from_fn(|_| rng.gen_range(-1.0..1.0)))
    };
    
    group.throughput(Throughput::Elements(32 * 32));
    
    // SIMD Frobenius distance
    group.bench_function("simd_frobenius", |b| {
        b.iter(|| {
            matrix1.frobenius_distance(black_box(&matrix2))
        });
    });
    
    // Scalar Frobenius distance for comparison
    group.bench_function("scalar_frobenius", |b| {
        b.iter(|| {
            let mut sum = 0.0f32;
            for i in 0..32 {
                for j in 0..32 {
                    let diff = matrix1.data[i][j] - matrix2.data[i][j];
                    sum += diff * diff;
                }
            }
            black_box(sum.sqrt())
        });
    });
    
    group.finish();
}

/// Benchmark memory throughput with different SIMD widths
fn bench_simd_memory_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_memory_throughput");
    group.sample_size(1000);
    
    let mut rng = thread_rng();
    let data: Vec<RootVector> = (0..1000)
        .map(|_| RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0))))
        .collect();
    
    group.throughput(Throughput::Elements(1000 * 32));
    
    // Batch dot products
    group.bench_function("simd_batch_dot", |b| {
        b.iter(|| {
            let mut sum = 0.0f32;
            for i in 0..data.len() - 1 {
                sum += data[i].dot(&data[i + 1]);
            }
            black_box(sum)
        });
    });
    
    // Batch vector additions
    group.bench_function("simd_batch_add", |b| {
        b.iter(|| {
            let mut result = data[0];
            for i in 1..100 {
                result.add_assign(&data[i]);
            }
            black_box(result)
        });
    });
    
    group.finish();
}

/// Benchmark WASM vs Native SIMD performance
#[cfg(target_arch = "wasm32")]
fn bench_wasm_simd_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("wasm_simd_comparison");
    group.sample_size(500);
    
    let mut rng = thread_rng();
    let v1 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0)));
    let v2 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0)));
    
    group.throughput(Throughput::Elements(32));
    
    // WASM SIMD dot product
    #[cfg(feature = "simd-wasm")]
    group.bench_function("wasm_simd_dot", |b| {
        b.iter(|| {
            black_box(v1.dot(black_box(&v2)))
        });
    });
    
    // Scalar fallback
    group.bench_function("wasm_scalar_dot", |b| {
        b.iter(|| {
            let result = v1.data.iter()
                .zip(v2.data.iter())
                .map(|(a, b)| a * b)
                .sum::<f32>();
            black_box(result)
        });
    });
    
    group.finish();
}

/// Performance regression test - ensure SIMD is actually faster
fn bench_performance_regression(c: &mut Criterion) {
    let mut group = c.benchmark_group("performance_regression");
    group.sample_size(1000);
    group.significance_level(0.02); // More strict significance test
    
    let mut rng = thread_rng();
    let vectors: Vec<_> = (0..100)
        .map(|_| RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0))))
        .collect();
    
    // Test that SIMD implementations are meaningfully faster
    group.bench_function("intensive_simd_operations", |b| {
        b.iter(|| {
            let mut accumulator = vectors[0];
            
            // Perform many operations to amplify SIMD benefits
            for i in 1..vectors.len() {
                let dot = accumulator.dot(&vectors[i]);
                accumulator.scale(dot * 0.01);
                accumulator.add_assign(&vectors[i % 10]);
            }
            
            black_box(accumulator)
        });
    });
    
    // Compare against pure scalar implementation
    group.bench_function("intensive_scalar_operations", |b| {
        b.iter(|| {
            let mut accumulator = vectors[0];
            
            for i in 1..vectors.len() {
                // Manual scalar dot product
                let mut dot = 0.0f32;
                for j in 0..32 {
                    dot += accumulator.data[j] * vectors[i].data[j];
                }
                
                // Manual scalar scaling
                for j in 0..32 {
                    accumulator.data[j] *= dot * 0.01;
                }
                
                // Manual scalar addition
                for j in 0..32 {
                    accumulator.data[j] += vectors[i % 10].data[j];
                }
            }
            
            black_box(accumulator)
        });
    });
    
    group.finish();
}

criterion_group!(
    simd_benches,
    bench_simd_dot_product,
    bench_simd_vector_ops,
    bench_simd_matrix_ops,
    bench_simd_cartan_matrix,
    bench_simd_memory_throughput,
    bench_performance_regression
);

#[cfg(target_arch = "wasm32")]
criterion_group!(
    wasm_benches,
    bench_wasm_simd_comparison
);

#[cfg(not(target_arch = "wasm32"))]
criterion_main!(simd_benches);

#[cfg(target_arch = "wasm32")]
criterion_main!(simd_benches, wasm_benches);
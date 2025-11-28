use micro_core::types::{RootVector, RootSpace, CartanMatrix};

/// Test that SIMD and scalar implementations produce identical results
#[test]
fn test_simd_scalar_equivalence() {
    let mut rng = rand::thread_rng();
    use rand::prelude::*;
    
    // Test data
    let v1 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-10.0..10.0)));
    let v2 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-10.0..10.0)));
    
    // Test dot product equivalence
    let simd_dot = v1.dot(&v2);
    let scalar_dot: f32 = v1.data.iter()
        .zip(v2.data.iter())
        .map(|(a, b)| a * b)
        .sum();
    
    // Allow for small floating point differences (SIMD can have different precision)
    assert!((simd_dot - scalar_dot).abs() < 1e-4, 
           "SIMD dot product differs from scalar: {} vs {}", simd_dot, scalar_dot);
}

#[test]
fn test_simd_vector_operations() {
    let mut rng = rand::thread_rng();
    use rand::prelude::*;
    
    let v1 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-5.0..5.0)));
    let v2 = RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-5.0..5.0)));
    let scalar = rng.gen_range(0.1..2.0);
    
    // Test vector addition
    let simd_add = v1.add(&v2);
    let mut scalar_add = v1;
    for i in 0..32 {
        scalar_add.data[i] += v2.data[i];
    }
    
    for i in 0..32 {
        assert!((simd_add.data[i] - scalar_add.data[i]).abs() < 1e-6,
               "SIMD add differs from scalar at index {}: {} vs {}", 
               i, simd_add.data[i], scalar_add.data[i]);
    }
    
    // Test scaling
    let mut simd_scale = v1;
    simd_scale.scale(scalar);
    
    let mut scalar_scale = v1;
    for i in 0..32 {
        scalar_scale.data[i] *= scalar;
    }
    
    for i in 0..32 {
        assert!((simd_scale.data[i] - scalar_scale.data[i]).abs() < 1e-6,
               "SIMD scale differs from scalar at index {}: {} vs {}", 
               i, simd_scale.data[i], scalar_scale.data[i]);
    }
}

#[test]
fn test_simd_projection_equivalence() {
    let root_space = RootSpace::new();
    let mut rng = rand::thread_rng();
    use rand::prelude::*;
    
    // Test with different input sizes
    for input_size in [32, 100, 500, 1000] {
        let input: Vec<f32> = (0..input_size)
            .map(|_| rng.gen_range(-1.0..1.0))
            .collect();
        
        let result = root_space.project(&input);
        
        // Manual projection for comparison
        let mut manual_result = RootVector::zero();
        for i in 0..32 {
            let mut sum = 0.0f32;
            for (j, &val) in input.iter().enumerate().take(32) {
                sum += val * root_space.basis[i].data[j];
            }
            manual_result.data[i] = sum;
        }
        
        for i in 0..32 {
            assert!((result.data[i] - manual_result.data[i]).abs() < 1e-5,
                   "SIMD projection differs from manual at index {}: {} vs {}", 
                   i, result.data[i], manual_result.data[i]);
        }
    }
}

#[test]
fn test_simd_cartan_matrix_operations() {
    let mut rng = rand::thread_rng();
    use rand::prelude::*;
    
    let matrix1 = CartanMatrix {
        data: core::array::from_fn(|_| core::array::from_fn(|_| rng.gen_range(-2.0..2.0)))
    };
    let matrix2 = CartanMatrix {
        data: core::array::from_fn(|_| core::array::from_fn(|_| rng.gen_range(-2.0..2.0)))
    };
    
    // Test Frobenius distance
    let simd_frobenius = matrix1.frobenius_distance(&matrix2);
    
    let mut scalar_sum = 0.0f32;
    for i in 0..32 {
        for j in 0..32 {
            let diff = matrix1.data[i][j] - matrix2.data[i][j];
            scalar_sum += diff * diff;
        }
    }
    let scalar_frobenius = scalar_sum.sqrt();
    
    assert!((simd_frobenius - scalar_frobenius).abs() < 1e-5,
           "SIMD Frobenius distance differs from scalar: {} vs {}", 
           simd_frobenius, scalar_frobenius);
}

/// Test edge cases for SIMD operations
#[test]
fn test_simd_edge_cases() {
    // Test with zero vectors
    let zero1 = RootVector::zero();
    let zero2 = RootVector::zero();
    assert_eq!(zero1.dot(&zero2), 0.0);
    assert_eq!(zero1.add(&zero2).data, [0.0; 32]);
    
    // Test with unit vectors
    let mut unit = RootVector::zero();
    unit.data[0] = 1.0;
    let mut unit2 = RootVector::zero();
    unit2.data[1] = 1.0;
    
    assert_eq!(unit.dot(&unit), 1.0);
    assert_eq!(unit.dot(&unit2), 0.0);
    
    // Test scaling edge cases
    let mut test_vec = RootVector::from_array([1.0; 32]);
    test_vec.scale(0.0);
    assert_eq!(test_vec.data, [0.0; 32]);
    
    test_vec = RootVector::from_array([2.0; 32]);
    test_vec.scale(0.5);
    assert_eq!(test_vec.data, [1.0; 32]);
}

/// Test numerical stability of SIMD operations
#[test]
fn test_simd_numerical_stability() {
    // Test with very small numbers
    let small1 = RootVector::from_array([1e-10; 32]);
    let small2 = RootVector::from_array([1e-10; 32]);
    let dot_result = small1.dot(&small2);
    assert!(dot_result >= 0.0 && dot_result < 1e-10);
    
    // Test with very large numbers
    let large1 = RootVector::from_array([1e6; 32]);
    let large2 = RootVector::from_array([1e6; 32]);
    let large_dot = large1.dot(&large2);
    assert!(large_dot > 1e12);
    
    // Test mixed scales
    let mut mixed = RootVector::zero();
    for i in 0..32 {
        mixed.data[i] = if i % 2 == 0 { 1e-5 } else { 1e5 };
    }
    let self_dot = mixed.dot(&mixed);
    assert!(self_dot > 0.0);
}

/// Performance sanity check - SIMD should be at least as fast as scalar
#[test]
fn test_simd_performance_sanity() {
    use std::time::Instant;
    
    let mut rng = rand::thread_rng();
    use rand::prelude::*;
    
    let vectors: Vec<_> = (0..1000)
        .map(|_| RootVector::from_array(core::array::from_fn(|_| rng.gen_range(-1.0..1.0))))
        .collect();
    
    // Time SIMD operations
    let start = Instant::now();
    let mut simd_sum = 0.0f32;
    for i in 0..vectors.len() - 1 {
        simd_sum += vectors[i].dot(&vectors[i + 1]);
    }
    let simd_time = start.elapsed();
    
    // Time scalar operations
    let start = Instant::now();
    let mut scalar_sum = 0.0f32;
    for i in 0..vectors.len() - 1 {
        let mut dot = 0.0f32;
        for j in 0..32 {
            dot += vectors[i].data[j] * vectors[i + 1].data[j];
        }
        scalar_sum += dot;
    }
    let scalar_time = start.elapsed();
    
    // Results should be equivalent
    assert!((simd_sum - scalar_sum).abs() < 1e-3);
    
    // SIMD should be at least as fast (allowing for 10% margin due to test variability)
    println!("SIMD time: {:?}, Scalar time: {:?}", simd_time, scalar_time);
    
    // In release mode with SIMD, we expect significant speedup
    #[cfg(all(feature = "simd", not(debug_assertions)))]
    assert!(simd_time <= scalar_time * 110 / 100, 
           "SIMD operations should be competitive with scalar: SIMD {:?} vs Scalar {:?}", 
           simd_time, scalar_time);
}
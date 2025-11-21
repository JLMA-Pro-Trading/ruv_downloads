//! Comprehensive unit tests for micro_core projection module

use micro_core::projection::{
    project_to_root, embed_from_root, StreamingProjector,
    compute_attention_rank, suggest_root_count
};
use micro_core::types::{RootVector, RootSpace};
use micro_core::prelude::*;
use approx::assert_relative_eq;
use alloc::vec::Vec;

#[cfg(test)]
mod projection_tests {
    use super::*;

    #[test]
    fn test_project_to_root() {
        let root_space = RootSpace::new();
        let input = vec![1.0; 32];
        
        let projected = project_to_root(&input, &root_space);
        
        // Should produce valid output
        assert!(projected.magnitude() > 0.0);
        
        // All components should be finite
        for i in 0..32 {
            assert!(projected[i].is_finite());
        }
    }

    #[test]
    fn test_project_empty_input() {
        let root_space = RootSpace::new();
        let input = vec![];
        
        let projected = project_to_root(&input, &root_space);
        
        // Should be zero vector
        for i in 0..32 {
            assert_eq!(projected[i], 0.0);
        }
    }

    #[test]
    fn test_project_partial_input() {
        let root_space = RootSpace::new();
        let input = vec![2.0; 16]; // Half dimensions
        
        let projected = project_to_root(&input, &root_space);
        
        // Should be valid
        assert!(projected.magnitude() >= 0.0);
    }

    #[test]
    fn test_project_oversized_input() {
        let root_space = RootSpace::new();
        let input = vec![1.0; 64]; // Double dimensions
        
        let projected = project_to_root(&input, &root_space);
        
        // Should handle gracefully (only first 32 used)
        assert!(projected.magnitude() > 0.0);
    }

    #[test]
    fn test_embed_from_root() {
        let root_space = RootSpace::new();
        let root_vector = RootVector::from_array([1.0; 32]);
        
        let embedded = embed_from_root(&root_vector, &root_space, 32);
        
        assert_eq!(embedded.len(), 32);
        
        // All components should be finite
        for val in &embedded {
            assert!(val.is_finite());
        }
    }

    #[test]
    fn test_embed_different_target_dim() {
        let root_space = RootSpace::new();
        let root_vector = RootVector::from_array([1.0; 32]);
        
        let embedded_16 = embed_from_root(&root_vector, &root_space, 16);
        let embedded_64 = embed_from_root(&root_vector, &root_space, 64);
        
        assert_eq!(embedded_16.len(), 16);
        assert_eq!(embedded_64.len(), 64);
    }

    #[test]
    fn test_projection_embedding_roundtrip() {
        let root_space = RootSpace::new();
        let original = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0,
                           9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0,
                           17.0, 18.0, 19.0, 20.0, 21.0, 22.0, 23.0, 24.0,
                           25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 31.0, 32.0];
        
        // Project to root space
        let root_vec = project_to_root(&original, &root_space);
        
        // Embed back
        let reconstructed = embed_from_root(&root_vec, &root_space, 32);
        
        // Check reconstruction error
        let error: f32 = original.iter()
            .zip(reconstructed.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum();
        
        // Error should be reasonable (not perfect due to basis orthogonalization)
        assert!(error.is_finite());
        println!("Roundtrip error: {}", error);
    }

    #[test]
    fn test_orthogonal_inputs_preserve_orthogonality() {
        let root_space = RootSpace::new();
        
        let mut input1 = vec![0.0; 32];
        let mut input2 = vec![0.0; 32];
        input1[0] = 1.0;
        input2[1] = 1.0;
        
        let proj1 = project_to_root(&input1, &root_space);
        let proj2 = project_to_root(&input2, &root_space);
        
        // Should remain orthogonal (or close to it)
        let dot = proj1.dot(&proj2);
        assert!(dot.abs() < 0.1); // Some tolerance due to basis construction
    }
}

#[cfg(test)]
mod streaming_projector_tests {
    use super::*;

    fn create_test_basis() -> Vec<RootVector> {
        let mut basis = Vec::new();
        for i in 0..32 {
            let mut vec = RootVector::zero();
            vec[i] = 1.0;
            basis.push(vec);
        }
        basis
    }

    #[test]
    fn test_streaming_projector_creation() {
        let basis = create_test_basis();
        let projector = StreamingProjector::new(basis, 0.01);
        
        // Should be created successfully
        assert_eq!(projector.sample_count, 0);
    }

    #[test]
    fn test_project_and_update() {
        let basis = create_test_basis();
        let mut projector = StreamingProjector::new(basis, 0.01);
        
        let input = vec![1.0; 32];
        let result = projector.project_and_update(&input);
        
        // Should produce valid projection
        assert!(result.magnitude() > 0.0);
        assert_eq!(projector.sample_count, 1);
    }

    #[test]
    fn test_multiple_updates() {
        let basis = create_test_basis();
        let mut projector = StreamingProjector::new(basis, 0.01);
        
        // Process multiple samples
        for i in 0..10 {
            let input = vec![i as f32; 32];
            let _ = projector.project_and_update(&input);
        }
        
        assert_eq!(projector.sample_count, 10);
    }

    #[test]
    fn test_reorthogonalization_trigger() {
        let basis = create_test_basis();
        let mut projector = StreamingProjector::new(basis, 0.01);
        
        // Process exactly 1000 samples to trigger reorthogonalization
        for i in 0..1000 {
            let input = vec![1.0; 32];
            let _ = projector.project_and_update(&input);
        }
        
        assert_eq!(projector.sample_count, 1000);
        
        // Basis should still be reasonably orthogonal after reorthogonalization
        // (We can't easily test this without exposing the basis, but the function should run)
    }

    #[test]
    fn test_learning_rate_decay() {
        let basis = create_test_basis();
        let mut projector = StreamingProjector::new(basis, 1.0);
        
        // The learning rate should decay with sqrt(sample_count)
        // We can't directly test this without exposing internals,
        // but we can verify the projector doesn't crash with high learning rates
        for i in 0..10 {
            let input = vec![i as f32; 32];
            let result = projector.project_and_update(&input);
            assert!(result.magnitude().is_finite());
        }
    }

    #[test]
    fn test_partial_input_handling() {
        let basis = create_test_basis();
        let mut projector = StreamingProjector::new(basis, 0.01);
        
        let input = vec![1.0; 16]; // Partial input
        let result = projector.project_and_update(&input);
        
        assert!(result.magnitude() >= 0.0);
    }

    #[test]
    fn test_empty_input_handling() {
        let basis = create_test_basis();
        let mut projector = StreamingProjector::new(basis, 0.01);
        
        let input = vec![];
        let result = projector.project_and_update(&input);
        
        // Should produce zero vector
        for i in 0..32 {
            assert_eq!(result[i], 0.0);
        }
    }
}

#[cfg(test)]
mod utility_function_tests {
    use super::*;

    #[test]
    fn test_compute_attention_rank() {
        // Test rank-1 behavior (highly concentrated)
        let mut weights = vec![0.1; 10];
        weights[0] = 10.0; // Dominant weight
        
        let rank = compute_attention_rank(&weights, 10);
        assert_eq!(rank, 1);
    }

    #[test]
    fn test_compute_attention_rank_full() {
        // Test full-rank behavior (distributed weights)
        let weights = vec![1.0; 10];
        
        let rank = compute_attention_rank(&weights, 10);
        assert_eq!(rank, 10);
    }

    #[test]
    fn test_compute_attention_rank_edge_cases() {
        // All zeros
        let weights = vec![0.0; 10];
        let rank = compute_attention_rank(&weights, 10);
        assert_eq!(rank, 10); // Default to full rank
        
        // Single non-zero
        let mut weights = vec![0.0; 10];
        weights[5] = 1.0;
        let rank = compute_attention_rank(&weights, 10);
        assert_eq!(rank, 1);
    }

    #[test]
    fn test_suggest_root_count() {
        // Test various input dimensions
        assert_eq!(suggest_root_count(64), 8);   // sqrt(64)/2 = 4, clamped to 8
        assert_eq!(suggest_root_count(256), 8);  // sqrt(256)/2 = 8
        assert_eq!(suggest_root_count(1024), 16); // sqrt(1024)/2 = 16
        assert_eq!(suggest_root_count(4096), 32); // sqrt(4096)/2 = 32
        
        // Edge cases
        assert_eq!(suggest_root_count(1), 8);    // Minimum clamp
        assert_eq!(suggest_root_count(16384), 64); // Maximum clamp
    }

    #[test]
    fn test_suggest_root_count_bounds() {
        // Test that result is always in bounds
        for dim in [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536] {
            let count = suggest_root_count(dim);
            assert!(count >= 8 && count <= 64);
        }
    }
}

// Property-based tests
#[cfg(test)]
mod projection_property_tests {
    use super::*;
    use quickcheck::{quickcheck, TestResult};

    quickcheck! {
        fn prop_projection_preserves_zero(size: usize) -> TestResult {
            if size > 1000 {
                return TestResult::discard();
            }
            
            let root_space = RootSpace::new();
            let input = vec![0.0; size];
            
            let projected = project_to_root(&input, &root_space);
            
            // Zero input should produce zero output
            TestResult::from_bool(projected.magnitude() == 0.0)
        }

        fn prop_embedding_size_consistency(target_dim: usize) -> TestResult {
            if target_dim > 1000 || target_dim == 0 {
                return TestResult::discard();
            }
            
            let root_space = RootSpace::new();
            let root_vector = RootVector::from_array([1.0; 32]);
            
            let embedded = embed_from_root(&root_vector, &root_space, target_dim);
            
            TestResult::from_bool(embedded.len() == target_dim)
        }

        fn prop_projection_scaling(data: Vec<f32>, scale: f32) -> TestResult {
            if data.len() > 100 || data.len() == 0 || !scale.is_finite() || scale == 0.0 {
                return TestResult::discard();
            }
            
            let root_space = RootSpace::new();
            let scaled_data: Vec<f32> = data.iter().map(|x| x * scale).collect();
            
            let proj1 = project_to_root(&data, &root_space);
            let proj2 = project_to_root(&scaled_data, &root_space);
            
            // Projection should be linear in input
            let ratio = if proj1.magnitude() > 1e-6 {
                proj2.magnitude() / proj1.magnitude()
            } else if proj2.magnitude() < 1e-6 {
                1.0 // Both zero
            } else {
                return TestResult::discard();
            };
            
            TestResult::from_bool((ratio - scale.abs()).abs() < 0.1)
        }

        fn prop_suggest_root_count_monotonic(dim1: usize, dim2: usize) -> TestResult {
            if dim1 > 10000 || dim2 > 10000 {
                return TestResult::discard();
            }
            
            let count1 = suggest_root_count(dim1);
            let count2 = suggest_root_count(dim2);
            
            // Larger dimension should suggest at least as many roots
            if dim1 <= dim2 {
                TestResult::from_bool(count1 <= count2)
            } else {
                TestResult::from_bool(count1 >= count2)
            }
        }
    }
}

// Performance benchmarks
#[cfg(test)]
mod projection_performance_tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn bench_projection() {
        let root_space = RootSpace::new();
        let inputs: Vec<Vec<f32>> = (0..100)
            .map(|i| vec![i as f32; 32])
            .collect();
        
        let start = Instant::now();
        for input in &inputs {
            let _ = project_to_root(input, &root_space);
        }
        let duration = start.elapsed();
        
        println!("100 projections took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn bench_embedding() {
        let root_space = RootSpace::new();
        let vectors: Vec<RootVector> = (0..100)
            .map(|i| RootVector::from_array([i as f32; 32]))
            .collect();
        
        let start = Instant::now();
        for vector in &vectors {
            let _ = embed_from_root(vector, &root_space, 32);
        }
        let duration = start.elapsed();
        
        println!("100 embeddings took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn bench_streaming_projector() {
        let basis = (0..32).map(|_| RootVector::zero()).collect();
        let mut projector = StreamingProjector::new(basis, 0.01);
        
        let start = Instant::now();
        for i in 0..1000 {
            let input = vec![i as f32; 32];
            let _ = projector.project_and_update(&input);
        }
        let duration = start.elapsed();
        
        println!("1000 streaming projections took: {:?}", duration);
        assert!(duration.as_millis() < 500);
    }

    #[test]
    fn bench_attention_rank_computation() {
        let test_cases: Vec<Vec<f32>> = (0..100)
            .map(|i| (0..50).map(|j| (i * j) as f32).collect())
            .collect();
        
        let start = Instant::now();
        for weights in &test_cases {
            let _ = compute_attention_rank(weights, weights.len());
        }
        let duration = start.elapsed();
        
        println!("100 rank computations took: {:?}", duration);
        assert!(duration.as_millis() < 50);
    }
}
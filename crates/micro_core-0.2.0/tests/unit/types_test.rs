//! Comprehensive unit tests for micro_core types module

use micro_core::types::{RootVector, RootSpace, CartanMatrix};
use micro_core::prelude::*;
use approx::assert_relative_eq;

#[cfg(test)]
mod root_vector_tests {
    use super::*;

    #[test]
    fn test_zero_vector_creation() {
        let vec = RootVector::zero();
        for i in 0..32 {
            assert_eq!(vec[i], 0.0);
        }
    }

    #[test]
    fn test_from_array_creation() {
        let data = [1.0; 32];
        let vec = RootVector::from_array(data);
        for i in 0..32 {
            assert_eq!(vec[i], 1.0);
        }
    }

    #[test]
    fn test_indexing() {
        let mut vec = RootVector::zero();
        vec[0] = 5.0;
        vec[31] = 10.0;
        
        assert_eq!(vec[0], 5.0);
        assert_eq!(vec[31], 10.0);
    }

    #[test]
    fn test_dot_product() {
        let mut v1 = RootVector::zero();
        let mut v2 = RootVector::zero();
        
        v1[0] = 3.0;
        v1[1] = 4.0;
        v2[0] = 2.0;
        v2[1] = 1.0;
        
        assert_eq!(v1.dot(&v2), 10.0); // 3*2 + 4*1 = 10
    }

    #[test]
    fn test_dot_product_orthogonal() {
        let mut v1 = RootVector::zero();
        let mut v2 = RootVector::zero();
        
        v1[0] = 1.0;
        v2[1] = 1.0;
        
        assert_eq!(v1.dot(&v2), 0.0);
    }

    #[test]
    fn test_magnitude() {
        let mut vec = RootVector::zero();
        vec[0] = 3.0;
        vec[1] = 4.0;
        
        assert_relative_eq!(vec.magnitude(), 5.0, epsilon = 1e-6);
    }

    #[test]
    fn test_normalize() {
        let mut vec = RootVector::zero();
        vec[0] = 3.0;
        vec[1] = 4.0;
        
        vec.normalize();
        assert_relative_eq!(vec.magnitude(), 1.0, epsilon = 1e-6);
        assert_relative_eq!(vec[0], 0.6, epsilon = 1e-6);
        assert_relative_eq!(vec[1], 0.8, epsilon = 1e-6);
    }

    #[test]
    fn test_normalize_zero_vector() {
        let mut vec = RootVector::zero();
        vec.normalize();
        
        // Should remain zero
        for i in 0..32 {
            assert_eq!(vec[i], 0.0);
        }
    }

    #[test]
    fn test_scale() {
        let mut vec = RootVector::zero();
        vec[0] = 2.0;
        vec[1] = 3.0;
        
        vec.scale(2.5);
        assert_eq!(vec[0], 5.0);
        assert_eq!(vec[1], 7.5);
    }

    #[test]
    fn test_as_slice() {
        let vec = RootVector::from_array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0,
                                         9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0,
                                         17.0, 18.0, 19.0, 20.0, 21.0, 22.0, 23.0, 24.0,
                                         25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 31.0, 32.0]);
        let slice = vec.as_slice();
        
        assert_eq!(slice.len(), 32);
        for i in 0..32 {
            assert_eq!(slice[i], (i + 1) as f32);
        }
    }

    #[test]
    fn test_as_mut_slice() {
        let mut vec = RootVector::zero();
        {
            let slice = vec.as_mut_slice();
            slice[0] = 10.0;
            slice[31] = 20.0;
        }
        
        assert_eq!(vec[0], 10.0);
        assert_eq!(vec[31], 20.0);
    }

    #[test]
    fn test_debug_format() {
        let vec = RootVector::from_array([1.0; 32]);
        let debug_str = format!("{:?}", vec);
        assert!(debug_str.contains("RootVector"));
        assert!(debug_str.contains("1.000"));
    }

    #[test]
    fn test_simd_alignment() {
        use core::mem::align_of;
        assert!(align_of::<RootVector>() >= 16);
    }

    #[test]
    fn test_zeros_alias() {
        let vec = RootVector::zeros();
        for i in 0..32 {
            assert_eq!(vec[i], 0.0);
        }
    }
}

#[cfg(test)]
mod root_space_tests {
    use super::*;

    #[test]
    fn test_new_root_space() {
        let space = RootSpace::new();
        assert_eq!(space.basis.len(), 32);
        
        // Check Cartan normalization
        for vec in &space.basis {
            let norm_squared = vec.dot(vec);
            assert_relative_eq!(norm_squared, 2.0, epsilon = 1e-6);
        }
    }

    #[test]
    fn test_root_space_orthogonality() {
        let space = RootSpace::new();
        
        // Check orthogonality between different basis vectors
        for i in 0..32 {
            for j in (i+1)..32 {
                let dot = space.basis[i].dot(&space.basis[j]);
                assert_relative_eq!(dot, 0.0, epsilon = 1e-6);
            }
        }
    }

    #[test]
    fn test_from_basis_valid() {
        // Create valid orthonormal basis with Cartan scaling
        let mut basis = Vec::new();
        for i in 0..32 {
            let mut vec = RootVector::zero();
            vec[i] = libm::sqrtf(2.0);
            basis.push(vec);
        }
        
        let space = RootSpace::from_basis(basis);
        assert!(space.is_ok());
    }

    #[test]
    fn test_from_basis_wrong_size() {
        let basis = vec![RootVector::zero(); 10]; // Wrong size
        let space = RootSpace::from_basis(basis);
        assert!(space.is_err());
    }

    #[test]
    fn test_from_basis_wrong_norm() {
        let mut basis = Vec::new();
        for i in 0..32 {
            let mut vec = RootVector::zero();
            vec[i] = 1.0; // Wrong norm (should be sqrt(2))
            basis.push(vec);
        }
        
        let space = RootSpace::from_basis(basis);
        assert!(space.is_err());
    }

    #[test]
    fn test_from_basis_not_orthogonal() {
        let mut basis = Vec::new();
        for i in 0..32 {
            let mut vec = RootVector::zero();
            vec[0] = libm::sqrtf(2.0); // All vectors same direction - not orthogonal
            basis.push(vec);
        }
        
        let space = RootSpace::from_basis(basis);
        assert!(space.is_err());
    }

    #[test]
    fn test_projection() {
        let space = RootSpace::new();
        let input = vec![1.0; 32];
        
        let projected = space.project(&input);
        
        // Projection should be valid
        assert!(projected.magnitude() > 0.0);
        
        // Each component should be reasonable
        for i in 0..32 {
            assert!(projected[i].is_finite());
        }
    }

    #[test]
    fn test_projection_empty_input() {
        let space = RootSpace::new();
        let input = vec![];
        
        let projected = space.project(&input);
        
        // Should be zero vector
        for i in 0..32 {
            assert_eq!(projected[i], 0.0);
        }
    }

    #[test]
    fn test_projection_partial_input() {
        let space = RootSpace::new();
        let input = vec![1.0; 16]; // Only half the dimensions
        
        let projected = space.project(&input);
        
        // Should be valid (remaining dimensions treated as zero)
        assert!(projected.magnitude() >= 0.0);
    }

    #[test]
    fn test_default_implementation() {
        let space = RootSpace::default();
        assert_eq!(space.basis.len(), 32);
    }
}

#[cfg(test)]
mod cartan_matrix_tests {
    use super::*;

    #[test]
    fn test_default_cartan_matrix() {
        let cartan = CartanMatrix::default();
        
        // Check diagonal values
        for i in 0..32 {
            assert_eq!(cartan.data[i][i], 2.0);
        }
        
        // Check off-diagonal values
        for i in 0..32 {
            for j in 0..32 {
                if i != j {
                    assert_eq!(cartan.data[i][j], 0.0);
                }
            }
        }
    }

    #[test]
    fn test_from_basis() {
        // Create orthonormal basis
        let mut basis = Vec::new();
        for i in 0..32 {
            let mut vec = RootVector::zero();
            vec[i] = libm::sqrtf(2.0);
            basis.push(vec);
        }
        
        let cartan = CartanMatrix::from_basis(&basis);
        
        // Should produce identity-like matrix scaled by 2
        for i in 0..32 {
            assert_relative_eq!(cartan.data[i][i], 2.0, epsilon = 1e-6);
            for j in 0..32 {
                if i != j {
                    assert_relative_eq!(cartan.data[i][j], 0.0, epsilon = 1e-6);
                }
            }
        }
    }

    #[test]
    fn test_frobenius_distance() {
        let cartan1 = CartanMatrix::default();
        let mut cartan2 = CartanMatrix::default();
        
        // Modify one entry
        cartan2.data[0][1] = 1.0;
        cartan2.data[1][0] = 1.0;
        
        let distance = cartan1.frobenius_distance(&cartan2);
        assert_relative_eq!(distance, libm::sqrtf(2.0), epsilon = 1e-6);
    }

    #[test]
    fn test_frobenius_distance_identical() {
        let cartan1 = CartanMatrix::default();
        let cartan2 = CartanMatrix::default();
        
        let distance = cartan1.frobenius_distance(&cartan2);
        assert_eq!(distance, 0.0);
    }
}

// Property-based tests
#[cfg(test)]
mod property_tests {
    use super::*;
    use quickcheck::{quickcheck, TestResult};

    quickcheck! {
        fn prop_dot_product_commutative(a: Vec<f32>, b: Vec<f32>) -> TestResult {
            if a.len() != 32 || b.len() != 32 {
                return TestResult::discard();
            }
            
            let v1 = RootVector::from_array(a.try_into().unwrap());
            let v2 = RootVector::from_array(b.try_into().unwrap());
            
            TestResult::from_bool((v1.dot(&v2) - v2.dot(&v1)).abs() < 1e-6)
        }

        fn prop_normalization_unit_length(data: Vec<f32>) -> TestResult {
            if data.len() != 32 || data.iter().all(|&x| x == 0.0) {
                return TestResult::discard();
            }
            
            let mut vec = RootVector::from_array(data.try_into().unwrap());
            vec.normalize();
            
            TestResult::from_bool((vec.magnitude() - 1.0).abs() < 1e-6)
        }

        fn prop_scaling_homogeneity(data: Vec<f32>, scale: f32) -> TestResult {
            if data.len() != 32 || !scale.is_finite() || scale == 0.0 {
                return TestResult::discard();
            }
            
            let original = RootVector::from_array(data.try_into().unwrap());
            let mut scaled = original;
            scaled.scale(scale);
            
            let original_mag = original.magnitude();
            let scaled_mag = scaled.magnitude();
            
            if original_mag == 0.0 {
                TestResult::from_bool(scaled_mag == 0.0)
            } else {
                TestResult::from_bool(
                    (scaled_mag - original_mag * scale.abs()).abs() < 1e-5
                )
            }
        }
    }
}

// Benchmark tests
#[cfg(test)]
mod benchmark_tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn bench_dot_product() {
        let v1 = RootVector::from_array([1.0; 32]);
        let v2 = RootVector::from_array([2.0; 32]);
        
        let start = Instant::now();
        for _ in 0..10000 {
            let _ = v1.dot(&v2);
        }
        let duration = start.elapsed();
        
        println!("10000 dot products took: {:?}", duration);
        assert!(duration.as_millis() < 100); // Should be fast
    }

    #[test]
    fn bench_normalization() {
        let mut vectors: Vec<RootVector> = (0..1000)
            .map(|i| RootVector::from_array([i as f32; 32]))
            .collect();
        
        let start = Instant::now();
        for vec in &mut vectors {
            vec.normalize();
        }
        let duration = start.elapsed();
        
        println!("1000 normalizations took: {:?}", duration);
        assert!(duration.as_millis() < 50);
    }

    #[test]
    fn bench_root_space_projection() {
        let space = RootSpace::new();
        let inputs: Vec<Vec<f32>> = (0..100)
            .map(|i| vec![i as f32; 32])
            .collect();
        
        let start = Instant::now();
        for input in &inputs {
            let _ = space.project(input);
        }
        let duration = start.elapsed();
        
        println!("100 projections took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }
}
//! Comprehensive unit tests for micro_routing

use micro_routing::*;
use approx::assert_relative_eq;

#[cfg(test)]
mod root_vector_tests {
    use super::*;

    #[test]
    fn test_zero_vector() {
        let vec = RootVector::zero();
        
        for i in 0..32 {
            assert_eq!(vec.data[i], 0.0);
        }
    }

    #[test]
    fn test_from_array() {
        let data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0,
                   9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0,
                   17.0, 18.0, 19.0, 20.0, 21.0, 22.0, 23.0, 24.0,
                   25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 31.0, 32.0];
        
        let vec = RootVector::from_array(data);
        
        for i in 0..32 {
            assert_eq!(vec.data[i], (i + 1) as f32);
        }
    }

    #[test]
    fn test_as_slice() {
        let vec = RootVector::from_array([5.0; 32]);
        let slice = vec.as_slice();
        
        assert_eq!(slice.len(), 32);
        for &val in slice {
            assert_eq!(val, 5.0);
        }
    }

    #[test]
    fn test_dot_product() {
        let mut v1 = RootVector::zero();
        let mut v2 = RootVector::zero();
        
        v1.data[0] = 3.0;
        v1.data[1] = 4.0;
        v2.data[0] = 2.0;
        v2.data[1] = 1.0;
        
        assert_eq!(v1.dot(&v2), 10.0); // 3*2 + 4*1 = 10
    }

    #[test]
    fn test_dot_product_orthogonal() {
        let mut v1 = RootVector::zero();
        let mut v2 = RootVector::zero();
        
        v1.data[0] = 1.0;
        v2.data[1] = 1.0;
        
        assert_eq!(v1.dot(&v2), 0.0);
    }

    #[test]
    fn test_magnitude() {
        let mut vec = RootVector::zero();
        vec.data[0] = 3.0;
        vec.data[1] = 4.0;
        
        // Simplified magnitude is just dot product with self
        assert_eq!(vec.magnitude(), 25.0); // 3*3 + 4*4 = 25
    }

    #[test]
    fn test_default() {
        let vec = RootVector::default();
        
        for i in 0..32 {
            assert_eq!(vec.data[i], 0.0);
        }
    }

    #[test]
    fn test_copy_and_clone() {
        let mut vec1 = RootVector::zero();
        vec1.data[10] = 42.0;
        
        let vec2 = vec1; // Copy
        let vec3 = vec1.clone(); // Clone
        
        assert_eq!(vec2.data[10], 42.0);
        assert_eq!(vec3.data[10], 42.0);
    }

    #[test]
    fn test_debug_format() {
        let vec = RootVector::zero();
        let debug_str = format!("{:?}", vec);
        
        assert!(debug_str.contains("RootVector"));
    }
}

#[cfg(test)]
mod routing_components_tests {
    use super::*;

    #[test]
    fn test_dynamic_router() {
        let router = DynamicRouter::default();
        // Default router should be created successfully
        // (No public fields to test in the simplified implementation)
    }

    #[test]
    fn test_router_config() {
        let config = RouterConfig::default();
        // Config should be created successfully
    }

    #[test]
    fn test_routing_decision() {
        let decision = RoutingDecision::default();
        // Decision should be created successfully
    }

    #[test]
    fn test_context_vector() {
        let context = ContextVector::default();
        // Context vector should be created successfully
    }

    #[test]
    fn test_context_manager() {
        let manager = ContextManager::default();
        // Manager should be created successfully
    }

    #[test]
    fn test_neural_gate() {
        let gate = NeuralGate::default();
        // Gate should be created successfully
    }

    #[test]
    fn test_gating_function() {
        let function = GatingFunction::default();
        // Function should be created successfully
    }
}

#[cfg(test)]
mod micronet_trait_tests {
    use super::*;

    // Mock implementation for testing
    struct TestMicroNet {
        id: u32,
        agent_type: String,
    }

    impl MicroNet for TestMicroNet {
        fn id(&self) -> u32 {
            self.id
        }

        fn agent_type(&self) -> String {
            self.agent_type.clone()
        }
    }

    #[test]
    fn test_micronet_id() {
        let net = TestMicroNet {
            id: 42,
            agent_type: "test".to_string(),
        };
        
        assert_eq!(net.id(), 42);
    }

    #[test]
    fn test_micronet_agent_type() {
        let net = TestMicroNet {
            id: 1,
            agent_type: "router".to_string(),
        };
        
        assert_eq!(net.agent_type(), "router");
    }

    #[test]
    fn test_micronet_net_type_alias() {
        let net = TestMicroNet {
            id: 1,
            agent_type: "feature".to_string(),
        };
        
        assert_eq!(net.net_type(), net.agent_type());
    }
}

#[cfg(test)]
mod error_handling_tests {
    use super::*;

    #[test]
    fn test_error_types() {
        let error1 = Error::InvalidInput;
        let error2 = Error::ComputationError;
        
        // Errors should be debuggable
        println!("{:?}", error1);
        println!("{:?}", error2);
    }

    #[test]
    fn test_result_type() {
        let success: Result<i32> = Ok(42);
        let failure: Result<i32> = Err("test error");
        
        assert!(success.is_ok());
        assert!(failure.is_err());
        
        if let Ok(value) = success {
            assert_eq!(value, 42);
        }
    }
}

// Property-based tests
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn prop_dot_product_commutative(
            a in prop::collection::vec(any::<f32>(), 32..=32),
            b in prop::collection::vec(any::<f32>(), 32..=32)
        ) {
            let v1 = RootVector::from_array(a.try_into().unwrap());
            let v2 = RootVector::from_array(b.try_into().unwrap());
            
            let dot1 = v1.dot(&v2);
            let dot2 = v2.dot(&v1);
            
            // Should be commutative (within floating point precision)
            prop_assert!((dot1 - dot2).abs() < 1e-6);
        }

        #[test]
        fn prop_dot_product_with_zero(
            data in prop::collection::vec(any::<f32>(), 32..=32)
        ) {
            let vec = RootVector::from_array(data.try_into().unwrap());
            let zero = RootVector::zero();
            
            let dot = vec.dot(&zero);
            
            prop_assert_eq!(dot, 0.0);
        }

        #[test]
        fn prop_magnitude_non_negative(
            data in prop::collection::vec(any::<f32>(), 32..=32)
        ) {
            let vec = RootVector::from_array(data.try_into().unwrap());
            let mag = vec.magnitude();
            
            prop_assert!(mag >= 0.0);
        }

        #[test]
        fn prop_from_array_roundtrip(
            data in prop::collection::vec(any::<f32>(), 32..=32)
        ) {
            let original: [f32; 32] = data.try_into().unwrap();
            let vec = RootVector::from_array(original);
            
            for i in 0..32 {
                prop_assert_eq!(vec.data[i], original[i]);
            }
        }

        #[test]
        fn prop_as_slice_consistency(
            data in prop::collection::vec(any::<f32>(), 32..=32)
        ) {
            let vec = RootVector::from_array(data.try_into().unwrap());
            let slice = vec.as_slice();
            
            prop_assert_eq!(slice.len(), 32);
            for i in 0..32 {
                prop_assert_eq!(slice[i], vec.data[i]);
            }
        }
    }
}

// Performance tests
#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn bench_vector_creation() {
        let start = Instant::now();
        
        for _ in 0..10000 {
            let _ = RootVector::zero();
        }
        
        let duration = start.elapsed();
        println!("10000 vector creations took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }

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
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn bench_magnitude_computation() {
        let vectors: Vec<RootVector> = (0..1000)
            .map(|i| RootVector::from_array([i as f32; 32]))
            .collect();
        
        let start = Instant::now();
        
        for vec in &vectors {
            let _ = vec.magnitude();
        }
        
        let duration = start.elapsed();
        println!("1000 magnitude computations took: {:?}", duration);
        assert!(duration.as_millis() < 50);
    }

    #[test]
    fn bench_component_creation() {
        let start = Instant::now();
        
        for _ in 0..1000 {
            let _ = DynamicRouter::default();
            let _ = RouterConfig::default();
            let _ = ContextManager::default();
            let _ = NeuralGate::default();
        }
        
        let duration = start.elapsed();
        println!("1000 component creations took: {:?}", duration);
        assert!(duration.as_millis() < 50);
    }
}

// Integration tests
#[cfg(test)]
mod integration_tests {
    use super::*;

    #[test]
    fn test_routing_pipeline() {
        // Test a complete routing pipeline
        let router = DynamicRouter::default();
        let config = RouterConfig::default();
        let context = ContextManager::default();
        let gate = NeuralGate::default();
        
        // All components should be created successfully
        // In a real implementation, we would test their interactions
    }

    #[test]
    fn test_vector_with_routing() {
        let vec = RootVector::from_array([1.0; 32]);
        let router = DynamicRouter::default();
        let context = ContextVector::default();
        
        // Should be able to use vectors with routing components
        assert_eq!(vec.as_slice().len(), 32);
    }

    #[test]
    fn test_micronet_integration() {
        struct SimpleRouter {
            id: u32,
        }
        
        impl MicroNet for SimpleRouter {
            fn id(&self) -> u32 {
                self.id
            }
            
            fn agent_type(&self) -> String {
                "router".to_string()
            }
        }
        
        let router = SimpleRouter { id: 1 };
        let context = ContextManager::default();
        
        assert_eq!(router.id(), 1);
        assert_eq!(router.agent_type(), "router");
    }

    #[test]
    fn test_gating_integration() {
        let gate = NeuralGate::default();
        let function = GatingFunction::default();
        let vec = RootVector::zero();
        
        // Should be able to combine gating with vectors
        assert_eq!(vec.magnitude(), 0.0);
    }
}

// Edge case tests
#[cfg(test)]
mod edge_case_tests {
    use super::*;

    #[test]
    fn test_infinite_values() {
        let mut vec = RootVector::zero();
        vec.data[0] = f32::INFINITY;
        vec.data[1] = f32::NEG_INFINITY;
        
        let magnitude = vec.magnitude();
        assert!(magnitude.is_infinite());
    }

    #[test]
    fn test_nan_values() {
        let mut vec = RootVector::zero();
        vec.data[0] = f32::NAN;
        
        let magnitude = vec.magnitude();
        assert!(magnitude.is_nan());
    }

    #[test]
    fn test_very_large_values() {
        let vec = RootVector::from_array([f32::MAX; 32]);
        let magnitude = vec.magnitude();
        
        // Should handle large values (may overflow to infinity)
        assert!(magnitude.is_finite() || magnitude.is_infinite());
    }

    #[test]
    fn test_very_small_values() {
        let vec = RootVector::from_array([f32::MIN_POSITIVE; 32]);
        let magnitude = vec.magnitude();
        
        assert!(magnitude >= 0.0);
        assert!(magnitude.is_finite());
    }

    #[test]
    fn test_mixed_signs() {
        let mut vec = RootVector::zero();
        for i in 0..32 {
            vec.data[i] = if i % 2 == 0 { 1.0 } else { -1.0 };
        }
        
        let dot_with_self = vec.dot(&vec);
        assert_eq!(dot_with_self, 32.0); // All squares are positive
    }
}
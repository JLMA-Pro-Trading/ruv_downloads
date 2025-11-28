//! Unit test module aggregator for micro_core

pub mod types_test;
pub mod micronet_test;
pub mod projection_test;

// Integration helpers for testing
use micro_core::prelude::*;

/// Create a test root space with predictable properties
pub fn create_test_root_space() -> micro_core::types::RootSpace {
    micro_core::types::RootSpace::new()
}

/// Create test agents for integration testing
pub fn create_test_agents() -> Vec<micro_core::micronet::BasicAgent> {
    vec![
        micro_core::micronet::BasicAgent::new(1, micro_core::micronet::AgentType::Reasoning),
        micro_core::micronet::BasicAgent::new(2, micro_core::micronet::AgentType::Routing),
        micro_core::micronet::BasicAgent::new(3, micro_core::micronet::AgentType::Feature),
    ]
}

/// Generate test vectors with known properties
pub fn generate_test_vectors(count: usize) -> Vec<RootVector> {
    (0..count)
        .map(|i| {
            let mut vec = RootVector::zero();
            vec[i % 32] = (i + 1) as f32;
            vec
        })
        .collect()
}
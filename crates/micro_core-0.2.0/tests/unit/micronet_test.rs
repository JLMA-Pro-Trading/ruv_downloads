//! Comprehensive unit tests for micro_core micronet module

use micro_core::micronet::{MicroNet, AgentState, AgentType, BasicAgent, AgentSwarm};
use micro_core::types::{RootVector, RootSpace};
use micro_core::prelude::*;
use approx::assert_relative_eq;

#[cfg(test)]
mod agent_state_tests {
    use super::*;

    #[test]
    fn test_new_agent_state() {
        let state = AgentState::new();
        
        assert_eq!(state.activation, 0.0);
        assert_eq!(state.confidence, 0.0);
        assert_eq!(state.update_count, 0);
        
        // Root vector should be zero
        for i in 0..32 {
            assert_eq!(state.root_vector[i], 0.0);
        }
    }

    #[test]
    fn test_with_vector() {
        let vec = RootVector::from_array([1.0; 32]);
        let state = AgentState::with_vector(vec);
        
        assert_eq!(state.activation, 1.0);
        assert_eq!(state.confidence, 1.0);
        assert_eq!(state.update_count, 0);
        
        for i in 0..32 {
            assert_eq!(state.root_vector[i], 1.0);
        }
    }

    #[test]
    fn test_update_state() {
        let mut state = AgentState::new();
        let new_vector = RootVector::from_array([2.0; 32]);
        
        state.update(new_vector, 0.5);
        
        assert_eq!(state.update_count, 1);
        
        // Vector should be interpolated: (1-0.5)*0 + 0.5*2 = 1.0
        for i in 0..32 {
            assert_eq!(state.root_vector[i], 1.0);
        }
    }

    #[test]
    fn test_update_confidence() {
        let mut state = AgentState::new();
        let new_vector = RootVector::from_array([1.0; 32]);
        
        state.update(new_vector, 0.1);
        
        // Confidence should be updated based on similarity
        assert!(state.confidence >= 0.0 && state.confidence <= 1.0);
    }

    #[test]
    fn test_multiple_updates() {
        let mut state = AgentState::new();
        
        for i in 1..=5 {
            let vec = RootVector::from_array([i as f32; 32]);
            state.update(vec, 0.2);
        }
        
        assert_eq!(state.update_count, 5);
    }
}

#[cfg(test)]
mod agent_type_tests {
    use super::*;

    #[test]
    fn test_agent_type_display() {
        assert_eq!(format!("{}", AgentType::Reasoning), "Reasoning");
        assert_eq!(format!("{}", AgentType::Routing), "Routing");
        assert_eq!(format!("{}", AgentType::Feature), "Feature");
        assert_eq!(format!("{}", AgentType::Embedding), "Embedding");
        assert_eq!(format!("{}", AgentType::Expert), "Expert");
    }

    #[test]
    fn test_agent_type_equality() {
        assert_eq!(AgentType::Reasoning, AgentType::Reasoning);
        assert_ne!(AgentType::Reasoning, AgentType::Routing);
    }
}

#[cfg(test)]
mod basic_agent_tests {
    use super::*;

    #[test]
    fn test_new_basic_agent() {
        let agent = BasicAgent::new(42, AgentType::Reasoning);
        
        assert_eq!(agent.id(), 42);
        assert_eq!(agent.agent_type(), AgentType::Reasoning);
        assert_eq!(agent.net_type(), AgentType::Reasoning);
        assert!(!agent.is_routing_head());
    }

    #[test]
    fn test_new_routing_agent() {
        let agent = BasicAgent::new_routing(123);
        
        assert_eq!(agent.id(), 123);
        assert_eq!(agent.agent_type(), AgentType::Routing);
        assert!(agent.is_routing_head());
    }

    #[test]
    fn test_new_reasoning_agent() {
        let agent = BasicAgent::new_reasoning(456);
        
        assert_eq!(agent.id(), 456);
        assert_eq!(agent.agent_type(), AgentType::Reasoning);
        assert!(!agent.is_routing_head());
    }

    #[test]
    fn test_with_weights() {
        let weights = RootVector::from_array([0.5; 32]);
        let agent = BasicAgent::new(1, AgentType::Expert).with_weights(weights);
        
        // Agent should be created successfully
        assert_eq!(agent.id(), 1);
    }

    #[test]
    fn test_update_state() {
        let mut agent = BasicAgent::new(1, AgentType::Feature);
        let new_state = RootVector::from_array([1.0; 32]);
        
        agent.update_state(new_state);
        
        // State should be updated
        assert_eq!(agent.state().update_count, 1);
    }

    #[test]
    fn test_forward_rank_one() {
        let weights = RootVector::from_array([1.0; 32]);
        let mut agent = BasicAgent::new_routing(1).with_weights(weights);
        
        let input = RootVector::from_array([2.0; 32]);
        let output = agent.forward(&input);
        
        // Output should be computed
        assert!(output.magnitude() > 0.0);
        
        // Agent state should be updated
        assert!(agent.state().activation > 0.0);
    }

    #[test]
    fn test_forward_full_rank() {
        let weights = RootVector::from_array([0.5; 32]);
        let mut agent = BasicAgent::new_reasoning(1).with_weights(weights);
        
        let input = RootVector::from_array([2.0; 32]);
        let output = agent.forward(&input);
        
        // Output should be computed
        assert!(output.magnitude() > 0.0);
    }

    #[test]
    fn test_compatibility_same_state() {
        let mut agent1 = BasicAgent::new(1, AgentType::Reasoning);
        let mut agent2 = BasicAgent::new(2, AgentType::Reasoning);
        
        let state = RootVector::from_array([1.0; 32]);
        agent1.update_state(state);
        agent2.update_state(state);
        
        let compat = agent1.compatibility(&agent2);
        assert!(compat > 0.9); // Should be highly compatible
    }

    #[test]
    fn test_compatibility_orthogonal_states() {
        let mut agent1 = BasicAgent::new(1, AgentType::Reasoning);
        let mut agent2 = BasicAgent::new(2, AgentType::Reasoning);
        
        let mut state1 = RootVector::zero();
        let mut state2 = RootVector::zero();
        state1[0] = 1.0;
        state2[1] = 1.0;
        
        agent1.update_state(state1);
        agent2.update_state(state2);
        
        let compat = agent1.compatibility(&agent2);
        assert_relative_eq!(compat, 0.5, epsilon = 0.1); // Should be neutral
    }

    #[test]
    fn test_compatibility_zero_states() {
        let agent1 = BasicAgent::new(1, AgentType::Reasoning);
        let agent2 = BasicAgent::new(2, AgentType::Reasoning);
        
        let compat = agent1.compatibility(&agent2);
        assert_eq!(compat, 0.5); // Neutral compatibility for zero states
    }
}

#[cfg(test)]
mod agent_swarm_tests {
    use super::*;
    use alloc::boxed::Box;

    #[test]
    fn test_new_swarm() {
        let root_space = RootSpace::new();
        let swarm = AgentSwarm::new(root_space);
        
        // Swarm should be empty initially
        assert_eq!(swarm.agents_by_type(AgentType::Reasoning).len(), 0);
    }

    #[test]
    fn test_add_agent() {
        let root_space = RootSpace::new();
        let mut swarm = AgentSwarm::new(root_space);
        
        let agent = Box::new(BasicAgent::new(1, AgentType::Reasoning));
        swarm.add_agent(agent);
        
        let reasoning_agents = swarm.agents_by_type(AgentType::Reasoning);
        assert_eq!(reasoning_agents.len(), 1);
        assert_eq!(reasoning_agents[0].id(), 1);
    }

    #[test]
    fn test_agents_by_type() {
        let root_space = RootSpace::new();
        let mut swarm = AgentSwarm::new(root_space);
        
        // Add different types of agents
        swarm.add_agent(Box::new(BasicAgent::new(1, AgentType::Reasoning)));
        swarm.add_agent(Box::new(BasicAgent::new(2, AgentType::Routing)));
        swarm.add_agent(Box::new(BasicAgent::new(3, AgentType::Reasoning)));
        
        let reasoning_agents = swarm.agents_by_type(AgentType::Reasoning);
        let routing_agents = swarm.agents_by_type(AgentType::Routing);
        let feature_agents = swarm.agents_by_type(AgentType::Feature);
        
        assert_eq!(reasoning_agents.len(), 2);
        assert_eq!(routing_agents.len(), 1);
        assert_eq!(feature_agents.len(), 0);
    }

    #[test]
    fn test_find_compatible() {
        let root_space = RootSpace::new();
        let mut swarm = AgentSwarm::new(root_space);
        
        // Create agents with similar states
        let mut agent1 = BasicAgent::new(1, AgentType::Reasoning);
        let mut agent2 = BasicAgent::new(2, AgentType::Reasoning);
        let mut agent3 = BasicAgent::new(3, AgentType::Reasoning);
        
        let similar_state = RootVector::from_array([1.0; 32]);
        let different_state = RootVector::from_array([-1.0; 32]);
        
        agent1.update_state(similar_state);
        agent2.update_state(similar_state);
        agent3.update_state(different_state);
        
        swarm.add_agent(Box::new(agent1));
        swarm.add_agent(Box::new(agent2));
        swarm.add_agent(Box::new(agent3));
        
        let test_agent = BasicAgent::new(99, AgentType::Reasoning);
        let compatible = swarm.find_compatible(&test_agent, 0.7);
        
        // Should find agents with similar states
        assert!(compatible.len() >= 1);
    }

    #[test]
    fn test_find_compatible_excludes_self() {
        let root_space = RootSpace::new();
        let mut swarm = AgentSwarm::new(root_space);
        
        let agent = BasicAgent::new(1, AgentType::Reasoning);
        let agent_clone = BasicAgent::new(1, AgentType::Reasoning); // Same ID
        
        swarm.add_agent(Box::new(agent_clone));
        
        let compatible = swarm.find_compatible(&agent, 0.0);
        assert_eq!(compatible.len(), 0); // Should not find itself
    }
}

// Property-based tests for micronet
#[cfg(test)]
mod micronet_property_tests {
    use super::*;
    use quickcheck::{quickcheck, TestResult};

    quickcheck! {
        fn prop_agent_id_consistency(id: u32) -> bool {
            let agent = BasicAgent::new(id, AgentType::Reasoning);
            agent.id() == id
        }

        fn prop_routing_agent_is_rank_one(id: u32) -> bool {
            let agent = BasicAgent::new_routing(id);
            agent.is_routing_head()
        }

        fn prop_compatibility_symmetric(data1: Vec<f32>, data2: Vec<f32>) -> TestResult {
            if data1.len() != 32 || data2.len() != 32 {
                return TestResult::discard();
            }

            let mut agent1 = BasicAgent::new(1, AgentType::Reasoning);
            let mut agent2 = BasicAgent::new(2, AgentType::Reasoning);

            let vec1 = RootVector::from_array(data1.try_into().unwrap());
            let vec2 = RootVector::from_array(data2.try_into().unwrap());

            agent1.update_state(vec1);
            agent2.update_state(vec2);

            let compat1 = agent1.compatibility(&agent2);
            let compat2 = agent2.compatibility(&agent1);

            TestResult::from_bool((compat1 - compat2).abs() < 1e-6)
        }

        fn prop_compatibility_bounds(data: Vec<f32>) -> TestResult {
            if data.len() != 32 {
                return TestResult::discard();
            }

            let mut agent1 = BasicAgent::new(1, AgentType::Reasoning);
            let mut agent2 = BasicAgent::new(2, AgentType::Reasoning);

            let vec = RootVector::from_array(data.try_into().unwrap());
            agent1.update_state(vec);
            agent2.update_state(vec);

            let compat = agent1.compatibility(&agent2);

            TestResult::from_bool(compat >= 0.0 && compat <= 1.0)
        }
    }
}

// Performance tests
#[cfg(test)]
mod micronet_performance_tests {
    use super::*;
    use std::time::Instant;
    use alloc::boxed::Box;

    #[test]
    fn bench_agent_forward() {
        let weights = RootVector::from_array([0.1; 32]);
        let mut agent = BasicAgent::new_reasoning(1).with_weights(weights);
        let input = RootVector::from_array([1.0; 32]);

        let start = Instant::now();
        for _ in 0..1000 {
            let _ = agent.forward(&input);
        }
        let duration = start.elapsed();

        println!("1000 forward passes took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn bench_compatibility_computation() {
        let mut agents: Vec<BasicAgent> = (0..100)
            .map(|i| {
                let mut agent = BasicAgent::new(i, AgentType::Reasoning);
                let state = RootVector::from_array([i as f32; 32]);
                agent.update_state(state);
                agent
            })
            .collect();

        let test_agent = &agents[0];

        let start = Instant::now();
        for agent in &agents[1..] {
            let _ = test_agent.compatibility(agent);
        }
        let duration = start.elapsed();

        println!("99 compatibility computations took: {:?}", duration);
        assert!(duration.as_millis() < 50);
    }

    #[test]
    fn bench_swarm_operations() {
        let root_space = RootSpace::new();
        let mut swarm = AgentSwarm::new(root_space);

        // Add 100 agents
        let start = Instant::now();
        for i in 0..100 {
            let agent_type = match i % 5 {
                0 => AgentType::Reasoning,
                1 => AgentType::Routing,
                2 => AgentType::Feature,
                3 => AgentType::Embedding,
                _ => AgentType::Expert,
            };
            swarm.add_agent(Box::new(BasicAgent::new(i, agent_type)));
        }
        let add_duration = start.elapsed();

        // Query by type
        let start = Instant::now();
        for _ in 0..100 {
            let _ = swarm.agents_by_type(AgentType::Reasoning);
        }
        let query_duration = start.elapsed();

        println!("Adding 100 agents took: {:?}", add_duration);
        println!("100 type queries took: {:?}", query_duration);

        assert!(add_duration.as_millis() < 100);
        assert!(query_duration.as_millis() < 50);
    }
}
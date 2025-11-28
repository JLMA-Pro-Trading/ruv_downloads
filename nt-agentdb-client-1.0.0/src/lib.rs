// AgentDB HTTP Client - Fast vector database operations
//
// Performance targets:
// - Query latency: <1ms for indexed lookups
// - Insert latency: <5ms for batches
// - Throughput: 1000+ ops/sec

pub mod client;
pub mod errors;
pub mod queries;
pub mod schema;

pub use client::AgentDBClient;
pub use errors::{AgentDBError, Result};
pub use schema::{Observation, Order, ReflexionTrace, Signal};
pub use queries::VectorQuery;

// Re-export commonly used types for convenience
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BatchDocument {
    pub id: String,
    pub content: String,
    pub metadata: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CollectionConfig {
    pub name: String,
    pub dimension: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distance_metric: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata_schema: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_structure() {
        // Smoke test
        assert!(true);
    }
}

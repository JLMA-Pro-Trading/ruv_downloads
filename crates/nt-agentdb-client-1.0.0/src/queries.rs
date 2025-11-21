// AgentDB Query Templates with <1ms performance targets

use crate::{
    client::AgentDBClient,
    errors::Result,
    schema::{Observation, Order, ReflexionTrace, Signal},
};
use chrono::Utc;
use serde::{Serialize, Deserialize};
use uuid::Uuid;

/// Query builder for vector similarity search
#[derive(Debug, Clone, Serialize)]
pub struct VectorQuery {
    pub collection: String,
    pub embedding: Vec<f32>,
    pub k: usize,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<Vec<Filter>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_score: Option<f32>,
}

impl VectorQuery {
    pub fn new(collection: String, embedding: Vec<f32>, k: usize) -> Self {
        Self {
            collection,
            embedding,
            k,
            filters: None,
            min_score: None,
        }
    }

    pub fn with_filter(mut self, filter: Filter) -> Self {
        self.filters.get_or_insert_with(Vec::new).push(filter);
        self
    }

    pub fn with_min_score(mut self, score: f32) -> Self {
        self.min_score = Some(score);
        self
    }
}

/// Filter for metadata queries
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Filter {
    Eq {
        field: String,
        value: serde_json::Value,
    },
    Ne {
        field: String,
        value: serde_json::Value,
    },
    Gt {
        field: String,
        value: serde_json::Value,
    },
    Gte {
        field: String,
        value: serde_json::Value,
    },
    Lt {
        field: String,
        value: serde_json::Value,
    },
    Lte {
        field: String,
        value: serde_json::Value,
    },
    In {
        field: String,
        values: Vec<serde_json::Value>,
    },
    And {
        filters: Vec<Filter>,
    },
    Or {
        filters: Vec<Filter>,
    },
}

impl Filter {
    pub fn eq(field: impl Into<String>, value: impl Serialize) -> Self {
        Self::Eq {
            field: field.into(),
            value: serde_json::to_value(value).unwrap(),
        }
    }

    pub fn gte(field: impl Into<String>, value: impl Serialize) -> Self {
        Self::Gte {
            field: field.into(),
            value: serde_json::to_value(value).unwrap(),
        }
    }

    pub fn lte(field: impl Into<String>, value: impl Serialize) -> Self {
        Self::Lte {
            field: field.into(),
            value: serde_json::to_value(value).unwrap(),
        }
    }

    pub fn and(filters: Vec<Filter>) -> Self {
        Self::And { filters }
    }

    pub fn or(filters: Vec<Filter>) -> Self {
        Self::Or { filters }
    }
}

/// Query templates for common operations
impl AgentDBClient {
    /// Find similar market conditions
    /// Target: <1ms for k=10
    pub async fn find_similar_conditions(
        &self,
        current: &Observation,
        k: usize,
        time_window_hours: Option<i64>,
    ) -> Result<Vec<Observation>> {
        let mut query = VectorQuery::new("observations".to_string(), current.embedding.clone(), k)
            .with_filter(Filter::eq("symbol", &current.symbol));

        if let Some(hours) = time_window_hours {
            let cutoff = current.timestamp_us - (hours * 3600 * 1_000_000);
            query = query.with_filter(Filter::gte("timestamp_us", cutoff));
        }

        self.vector_search(query).await
    }

    /// Get signals by strategy
    /// Target: <1ms
    pub async fn get_signals_by_strategy(
        &self,
        strategy_id: &str,
        min_confidence: f64,
        limit: usize,
    ) -> Result<Vec<Signal>> {
        let query = MetadataQuery {
            collection: "signals".to_string(),
            filters: vec![
                Filter::eq("strategy_id", strategy_id),
                Filter::gte("confidence", min_confidence),
            ],
            limit: Some(limit),
            sort_by: Some(SortBy {
                field: "confidence".to_string(),
                order: SortOrder::Desc,
            }),
        };

        self.metadata_search(query).await
    }

    /// Find similar trading decisions
    /// Target: <1ms for k=10
    pub async fn find_similar_decisions(&self, signal: &Signal, k: usize) -> Result<Vec<Signal>> {
        let query = VectorQuery::new("signals".to_string(), signal.embedding.clone(), k)
            .with_filter(Filter::eq("symbol", &signal.symbol));

        self.vector_search(query).await
    }

    /// Get top performing strategies
    /// Target: <50ms for 1000 traces
    pub async fn get_top_strategies(
        &self,
        min_score: f64,
        limit: usize,
    ) -> Result<Vec<(String, f64)>> {
        let query = MetadataQuery {
            collection: "reflexion_traces".to_string(),
            filters: vec![Filter::gte("verdict.score", min_score)],
            limit: Some(limit * 10), // Get more to aggregate
            sort_by: Some(SortBy {
                field: "verdict.sharpe".to_string(),
                order: SortOrder::Desc,
            }),
        };

        let traces: Vec<ReflexionTrace> = self.metadata_search(query).await?;

        // Aggregate by strategy (simplified)
        let mut strategy_scores = std::collections::HashMap::new();

        for trace in traces {
            // Extract strategy from decision
            // This is simplified - in practice, we'd join with signals table
            let score = trace.verdict.score;
            strategy_scores
                .entry("strategy_placeholder".to_string())
                .or_insert_with(Vec::new)
                .push(score);
        }

        let mut results: Vec<(String, f64)> = strategy_scores
            .into_iter()
            .map(|(strategy, scores)| {
                let avg = scores.iter().sum::<f64>() / scores.len() as f64;
                (strategy, avg)
            })
            .collect();

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        results.truncate(limit);

        Ok(results)
    }

    /// Get observations in time range
    /// Target: <5ms for 1-hour window
    pub async fn get_observations_in_range(
        &self,
        symbol: &str,
        start_us: i64,
        end_us: i64,
    ) -> Result<Vec<Observation>> {
        let query = MetadataQuery {
            collection: "observations".to_string(),
            filters: vec![
                Filter::eq("symbol", symbol),
                Filter::gte("timestamp_us", start_us),
                Filter::lte("timestamp_us", end_us),
            ],
            limit: Some(10000),
            sort_by: Some(SortBy {
                field: "timestamp_us".to_string(),
                order: SortOrder::Asc,
            }),
        };

        self.metadata_search(query).await
    }

    /// Get orders for signal
    /// Target: <1ms
    pub async fn get_orders_for_signal(&self, signal_id: Uuid) -> Result<Vec<Order>> {
        let query = MetadataQuery {
            collection: "orders".to_string(),
            filters: vec![Filter::eq("signal_id", signal_id.to_string())],
            limit: Some(100),
            sort_by: Some(SortBy {
                field: "timestamps.created_us".to_string(),
                order: SortOrder::Asc,
            }),
        };

        self.metadata_search(query).await
    }

    /// Get recent signals
    /// Target: <1ms
    pub async fn get_recent_signals(&self, symbol: &str, limit: usize) -> Result<Vec<Signal>> {
        let cutoff = Utc::now().timestamp_micros() - (24 * 3600 * 1_000_000); // Last 24 hours

        let query = MetadataQuery {
            collection: "signals".to_string(),
            filters: vec![
                Filter::eq("symbol", symbol),
                Filter::gte("timestamp_us", cutoff),
            ],
            limit: Some(limit),
            sort_by: Some(SortBy {
                field: "timestamp_us".to_string(),
                order: SortOrder::Desc,
            }),
        };

        self.metadata_search(query).await
    }
}

/// Metadata-only query
#[derive(Debug, Clone, Serialize)]
pub struct MetadataQuery {
    pub collection: String,
    pub filters: Vec<Filter>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_by: Option<SortBy>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SortBy {
    pub field: String,
    pub order: SortOrder,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_builder() {
        let filter = Filter::eq("symbol", "AAPL");

        match filter {
            Filter::Eq { field, value } => {
                assert_eq!(field, "symbol");
                assert_eq!(value, serde_json::json!("AAPL"));
            }
            _ => panic!("Wrong filter type"),
        }
    }

    #[test]
    fn test_and_filter() {
        let filter = Filter::and(vec![
            Filter::eq("symbol", "AAPL"),
            Filter::gte("confidence", 0.8),
        ]);

        match filter {
            Filter::And { filters } => {
                assert_eq!(filters.len(), 2);
            }
            _ => panic!("Wrong filter type"),
        }
    }

    #[test]
    fn test_vector_query_builder() {
        let query = VectorQuery::new("observations".to_string(), vec![0.1, 0.2, 0.3], 10)
            .with_filter(Filter::eq("symbol", "AAPL"))
            .with_min_score(0.8);

        assert_eq!(query.collection, "observations");
        assert_eq!(query.k, 10);
        assert!(query.filters.is_some());
        assert_eq!(query.min_score, Some(0.8));
    }
}

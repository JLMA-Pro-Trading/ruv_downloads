//! Vector store with semantic search capabilities

use crate::Result;
use nt_agentdb_client::{AgentDBClient, BatchDocument, CollectionConfig};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Vector store for semantic search
pub struct VectorStore {
    client: Arc<AgentDBClient>,
    collections: Arc<RwLock<std::collections::HashSet<String>>>,
}

impl VectorStore {
    /// Create new vector store
    pub async fn new(base_url: &str) -> anyhow::Result<Self> {
        let client = AgentDBClient::new(base_url.to_string());

        // Verify connection
        client.health_check().await?;

        Ok(Self {
            client: Arc::new(client),
            collections: Arc::new(RwLock::new(std::collections::HashSet::new())),
        })
    }

    /// Ensure collection exists
    pub async fn ensure_collection(
        &self,
        name: &str,
        dimension: usize,
    ) -> anyhow::Result<()> {
        let mut collections = self.collections.write().await;

        if collections.contains(name) {
            return Ok(());
        }

        // Use the client module's CollectionConfig
        use nt_agentdb_client::client::CollectionConfig;

        let config = CollectionConfig {
            name: name.to_string(),
            dimension,
            index_type: "hnsw".to_string(),
            metadata_schema: None,
        };

        self.client.create_collection(config).await
            .map_err(|e| anyhow::anyhow!("AgentDB error: {}", e))?;
        collections.insert(name.to_string());

        Ok(())
    }

    /// Insert vector with metadata
    pub async fn insert<T: Serialize>(
        &self,
        collection: &str,
        id: &str,
        embedding: Vec<f32>,
        metadata: Option<T>,
    ) -> anyhow::Result<()> {
        let id_bytes = id.as_bytes();

        self.client
            .insert(collection, id_bytes, &embedding, metadata.as_ref())
            .await?;

        Ok(())
    }

    /// Batch insert vectors
    pub async fn batch_insert<T: Serialize>(
        &self,
        collection: &str,
        documents: Vec<(String, Vec<f32>, Option<T>)>,
    ) -> anyhow::Result<usize> {
        // Use the client module's BatchDocument
        use nt_agentdb_client::client::BatchDocument;

        let batch: Vec<BatchDocument<T>> = documents
            .into_iter()
            .map(|(id, embedding, metadata)| BatchDocument {
                id: id.into_bytes(),
                embedding,
                metadata,
            })
            .collect();

        let response = self.client.batch_insert(collection, batch).await
            .map_err(|e| anyhow::anyhow!("AgentDB error: {}", e))?;
        Ok(response.inserted)
    }

    /// Search for similar vectors
    pub async fn search(
        &self,
        collection: &str,
        query_embedding: Vec<f32>,
        top_k: usize,
    ) -> Result<Vec<(String, f32)>> {
        use nt_agentdb_client::VectorQuery;

        let query = VectorQuery::new(
            collection.to_string(),
            query_embedding,
            top_k,
        );

        let results: Vec<SearchResult> = self
            .client
            .vector_search(query)
            .await
            .map_err(|e| crate::MemoryError::VectorDB(e.to_string()))?;

        Ok(results
            .into_iter()
            .map(|r| (r.id, r.score))
            .collect())
    }

    /// Get vector by ID
    pub async fn get<T: for<'de> Deserialize<'de>>(
        &self,
        collection: &str,
        id: &str,
    ) -> anyhow::Result<Option<T>> {
        let id_bytes = id.as_bytes();
        self.client.get(collection, id_bytes).await
            .map_err(|e| anyhow::anyhow!("AgentDB error: {}", e))
    }

    /// Delete vector
    pub async fn delete(&self, collection: &str, id: &str) -> anyhow::Result<()> {
        let id_bytes = id.as_bytes();
        self.client.delete(collection, id_bytes).await
            .map_err(|e| anyhow::anyhow!("AgentDB error: {}", e))
    }
}

/// Search result with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires AgentDB server
    async fn test_vector_store_operations() {
        let store = VectorStore::new("http://localhost:3000")
            .await
            .unwrap();

        // Create collection
        store
            .ensure_collection("test_collection", 384)
            .await
            .unwrap();

        // Insert vector
        let embedding = vec![0.1; 384];
        store
            .insert(
                "test_collection",
                "test_id",
                embedding.clone(),
                Some(serde_json::json!({"type": "test"})),
            )
            .await
            .unwrap();

        // Search
        let results = store
            .search("test_collection", embedding, 1)
            .await
            .unwrap();

        assert_eq!(results.len(), 1);
    }
}

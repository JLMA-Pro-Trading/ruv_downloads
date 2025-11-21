// AgentDB HTTP Client Implementation
//
// Performance targets:
// - Vector search: <1ms
// - Batch insert: <10ms for 1000 items
// - Connection pooling for throughput

use crate::{
    errors::{AgentDBError, Result},
    queries::{MetadataQuery, VectorQuery},
};
use reqwest::{Client, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info};

pub struct AgentDBClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
}

impl AgentDBClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10) // Connection pooling
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url,
            api_key: None,
        }
    }

    pub fn with_api_key(mut self, api_key: String) -> Self {
        self.api_key = Some(api_key);
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.client = Client::builder()
            .timeout(timeout)
            .pool_max_idle_per_host(10)
            .build()
            .expect("Failed to build HTTP client");
        self
    }

    /// Insert single document
    pub async fn insert<T: Serialize>(
        &self,
        collection: &str,
        id: &[u8],
        embedding: &[f32],
        metadata: Option<&T>,
    ) -> Result<InsertResponse> {
        let url = format!("{}/collections/{}/insert", self.base_url, collection);

        let body = InsertRequest {
            id: hex::encode(id),
            embedding: embedding.to_vec(),
            metadata: metadata.map(|m| serde_json::to_value(m).unwrap()),
        };

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        self.handle_response(response).await
    }

    /// Batch insert documents
    pub async fn batch_insert<T: Serialize>(
        &self,
        collection: &str,
        documents: Vec<BatchDocument<T>>,
    ) -> Result<BatchInsertResponse> {
        let url = format!("{}/collections/{}/batch_insert", self.base_url, collection);

        let body = BatchInsertRequest {
            documents: documents
                .into_iter()
                .map(|doc| InsertRequest {
                    id: hex::encode(&doc.id),
                    embedding: doc.embedding,
                    metadata: doc.metadata.map(|m| serde_json::to_value(m).unwrap()),
                })
                .collect(),
        };

        debug!("Batch inserting {} documents", body.documents.len());

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        self.handle_response(response).await
    }

    /// Vector similarity search
    pub async fn vector_search<T: DeserializeOwned>(&self, query: VectorQuery) -> Result<Vec<T>> {
        let url = format!("{}/collections/{}/search", self.base_url, query.collection);

        let response = self
            .client
            .post(&url)
            .json(&query)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        let search_result: SearchResponse<T> = self.handle_response(response).await?;
        Ok(search_result
            .results
            .into_iter()
            .map(|r| r.document)
            .collect())
    }

    /// Metadata-only search
    pub async fn metadata_search<T: DeserializeOwned>(
        &self,
        query: MetadataQuery,
    ) -> Result<Vec<T>> {
        let url = format!("{}/collections/{}/query", self.base_url, query.collection);

        let response = self
            .client
            .post(&url)
            .json(&query)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        let query_result: QueryResponse<T> = self.handle_response(response).await?;
        Ok(query_result.documents)
    }

    /// Get document by ID
    pub async fn get<T: DeserializeOwned>(&self, collection: &str, id: &[u8]) -> Result<Option<T>> {
        let url = format!(
            "{}/collections/{}/documents/{}",
            self.base_url,
            collection,
            hex::encode(id)
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        match response.status() {
            StatusCode::OK => {
                let doc = self.handle_response(response).await?;
                Ok(Some(doc))
            }
            StatusCode::NOT_FOUND => Ok(None),
            _ => Err(AgentDBError::Network("Failed to get document".to_string())),
        }
    }

    /// Delete document
    pub async fn delete(&self, collection: &str, id: &[u8]) -> Result<()> {
        let url = format!(
            "{}/collections/{}/documents/{}",
            self.base_url,
            collection,
            hex::encode(id)
        );

        let response = self
            .client
            .delete(&url)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        match response.status() {
            StatusCode::OK | StatusCode::NO_CONTENT => Ok(()),
            StatusCode::NOT_FOUND => Err(AgentDBError::NotFound("Document not found".to_string())),
            _ => Err(AgentDBError::Network(
                "Failed to delete document".to_string(),
            )),
        }
    }

    /// Create collection
    pub async fn create_collection(&self, config: CollectionConfig) -> Result<()> {
        let url = format!("{}/collections", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&config)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        match response.status() {
            StatusCode::OK | StatusCode::CREATED => {
                info!("Collection '{}' created successfully", config.name);
                Ok(())
            }
            StatusCode::CONFLICT => {
                info!("Collection '{}' already exists", config.name);
                Ok(())
            }
            _ => Err(AgentDBError::Network(
                "Failed to create collection".to_string(),
            )),
        }
    }

    /// Health check
    pub async fn health_check(&self) -> Result<HealthResponse> {
        let url = format!("{}/health", self.base_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AgentDBError::Network(e.to_string()))?;

        self.handle_response(response).await
    }

    async fn handle_response<T: DeserializeOwned>(&self, response: reqwest::Response) -> Result<T> {
        match response.status() {
            StatusCode::OK | StatusCode::CREATED => response
                .json()
                .await
                .map_err(|e| AgentDBError::Serialization(e.to_string())),
            StatusCode::BAD_REQUEST => {
                let error_text = response.text().await.unwrap_or_default();
                Err(AgentDBError::InvalidQuery(error_text))
            }
            StatusCode::NOT_FOUND => {
                let error_text = response.text().await.unwrap_or_default();
                Err(AgentDBError::NotFound(error_text))
            }
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                Err(AgentDBError::Auth("Authentication failed".to_string()))
            }
            _ => {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                error!("HTTP {}: {}", status, error_text);
                Err(AgentDBError::Network(format!(
                    "HTTP {}: {}",
                    status, error_text
                )))
            }
        }
    }
}

// Request/Response types

#[derive(Debug, Serialize)]
struct InsertRequest {
    id: String,
    embedding: Vec<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct InsertResponse {
    pub id: String,
    pub success: bool,
}

#[derive(Debug, Serialize)]
struct BatchInsertRequest {
    documents: Vec<InsertRequest>,
}

#[derive(Debug, Deserialize)]
pub struct BatchInsertResponse {
    pub inserted: usize,
    pub failed: usize,
}

pub struct BatchDocument<T> {
    pub id: Vec<u8>,
    pub embedding: Vec<f32>,
    pub metadata: Option<T>,
}

#[derive(Debug, Deserialize)]
struct SearchResponse<T> {
    results: Vec<SearchResult<T>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct SearchResult<T> {
    document: T,
    score: f32,
}

#[derive(Debug, Deserialize)]
struct QueryResponse<T> {
    documents: Vec<T>,
}

#[derive(Debug, Serialize)]
pub struct CollectionConfig {
    pub name: String,
    pub dimension: usize,
    pub index_type: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata_schema: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = AgentDBClient::new("http://localhost:8080".to_string());
        assert_eq!(client.base_url, "http://localhost:8080");
    }

    #[test]
    fn test_client_with_api_key() {
        let client = AgentDBClient::new("http://localhost:8080".to_string())
            .with_api_key("test_key".to_string());

        assert_eq!(client.api_key, Some("test_key".to_string()));
    }

    #[tokio::test]
    async fn test_hex_encoding() {
        let id = vec![0x01, 0x02, 0x03, 0x04];
        let hex = hex::encode(&id);
        assert_eq!(hex, "01020304");
    }
}

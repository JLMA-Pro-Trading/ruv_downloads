use thiserror::Error;

pub type Result<T> = std::result::Result<T, AgentDBError>;

#[derive(Debug, Error)]
pub enum AgentDBError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid query: {0}")]
    InvalidQuery(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Timeout")]
    Timeout,

    #[error("Collection not found: {0}")]
    CollectionNotFound(String),

    #[error("Index error: {0}")]
    Index(String),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

use thiserror::Error;

pub type Result<T> = std::result::Result<T, MarketDataError>;

#[derive(Debug, Error)]
pub enum MarketDataError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error("Symbol not found: {0}")]
    SymbolNotFound(String),

    #[error("Provider unavailable: {0}")]
    ProviderUnavailable(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("WebSocket error: {0}")]
    WebSocket(String),

    #[error("Timeout")]
    Timeout,

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
}

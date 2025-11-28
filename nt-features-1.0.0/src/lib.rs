// Feature Engineering Module - Technical indicators and embeddings
//
// Performance targets:
// - Feature extraction: <1ms per update
// - Embedding generation: <100μs

pub mod embeddings;
pub mod normalization;
pub mod technical;

pub use embeddings::{hash_embed, EmbeddingGenerator};
pub use normalization::{FeatureNormalizer, NormalizationMethod};
pub use technical::{IndicatorConfig, TechnicalIndicators};

#[derive(Debug, thiserror::Error)]
pub enum FeatureError {
    #[error("Insufficient data: need at least {0} points")]
    InsufficientData(usize),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Calculation error: {0}")]
    Calculation(String),
}

pub type Result<T> = std::result::Result<T, FeatureError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_structure() {
        // Smoke test
        assert!(true);
    }
}

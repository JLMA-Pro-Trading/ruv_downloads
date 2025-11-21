//! Embedding generation for semantic search

use serde::Serialize;
use std::hash::{Hash, Hasher};

/// Vector embedding
pub type Embedding = Vec<f32>;

/// Embedding provider trait
#[async_trait::async_trait]
pub trait EmbeddingProvider: Send + Sync {
    /// Generate embedding for text
    async fn embed(&self, text: &str) -> anyhow::Result<Embedding>;

    /// Generate embeddings for batch of texts
    async fn embed_batch(&self, texts: &[String]) -> anyhow::Result<Vec<Embedding>>;

    /// Embedding dimension
    fn dimension(&self) -> usize;
}

/// Simple deterministic embedding provider (for testing)
pub struct DeterministicEmbedder {
    dimension: usize,
}

impl DeterministicEmbedder {
    pub fn new(dimension: usize) -> Self {
        Self { dimension }
    }

    fn hash_to_embedding(&self, text: &str) -> Embedding {
        use std::collections::hash_map::DefaultHasher;

        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let hash = hasher.finish();

        // Generate deterministic embedding from hash
        let mut embedding = Vec::with_capacity(self.dimension);
        let mut current_hash = hash;

        for _ in 0..self.dimension {
            // Use linear congruential generator for more values
            current_hash = current_hash.wrapping_mul(1103515245).wrapping_add(12345);
            let value = ((current_hash >> 16) & 0xFFFF) as f32 / 65535.0;
            embedding.push(value * 2.0 - 1.0); // Normalize to [-1, 1]
        }

        // Normalize to unit vector
        let magnitude: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            embedding.iter_mut().for_each(|x| *x /= magnitude);
        }

        embedding
    }
}

#[async_trait::async_trait]
impl EmbeddingProvider for DeterministicEmbedder {
    async fn embed(&self, text: &str) -> anyhow::Result<Embedding> {
        Ok(self.hash_to_embedding(text))
    }

    async fn embed_batch(&self, texts: &[String]) -> anyhow::Result<Vec<Embedding>> {
        Ok(texts
            .iter()
            .map(|text| self.hash_to_embedding(text))
            .collect())
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}

/// Cosine similarity between embeddings
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();

    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if mag_a > 0.0 && mag_b > 0.0 {
        dot_product / (mag_a * mag_b)
    } else {
        0.0
    }
}

/// Euclidean distance between embeddings
pub fn euclidean_distance(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return f32::MAX;
    }

    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f32>()
        .sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_deterministic_embedder() {
        let embedder = DeterministicEmbedder::new(384);

        let text = "test string";
        let embedding1 = embedder.embed(text).await.unwrap();
        let embedding2 = embedder.embed(text).await.unwrap();

        // Should be deterministic
        assert_eq!(embedding1, embedding2);
        assert_eq!(embedding1.len(), 384);
    }

    #[tokio::test]
    async fn test_batch_embedding() {
        let embedder = DeterministicEmbedder::new(128);

        let texts = vec!["hello".to_string(), "world".to_string()];
        let embeddings = embedder.embed_batch(&texts).await.unwrap();

        assert_eq!(embeddings.len(), 2);
        assert_eq!(embeddings[0].len(), 128);
        assert_eq!(embeddings[1].len(), 128);
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let c = vec![0.0, 1.0, 0.0];

        // Identical vectors
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 0.001);

        // Orthogonal vectors
        assert!(cosine_similarity(&a, &c).abs() < 0.001);
    }

    #[test]
    fn test_euclidean_distance() {
        let a = vec![0.0, 0.0];
        let b = vec![3.0, 4.0];

        // Distance should be 5.0
        assert!((euclidean_distance(&a, &b) - 5.0).abs() < 0.001);
    }
}

// Deterministic hash-based embeddings
//
// Performance target: <100μs per embedding generation
// Uses SeaHash for fast, deterministic hashing

use seahash::hash;

/// Generate deterministic hash-based embedding
pub fn hash_embed(data: &[u8], dimension: usize) -> Vec<f32> {
    let mut embedding = Vec::with_capacity(dimension);

    for i in 0..dimension {
        // Combine dimension index with data for unique hash per dimension
        let mut combined = Vec::with_capacity(8 + data.len());
        combined.extend_from_slice(&(i as u64).to_le_bytes());
        combined.extend_from_slice(data);

        let hash_value = hash(&combined);

        // Convert to [-1.0, 1.0] range
        let normalized = (hash_value as f64 / u64::MAX as f64) * 2.0 - 1.0;
        embedding.push(normalized as f32);
    }

    embedding
}

pub struct EmbeddingGenerator {
    dimension: usize,
}

impl EmbeddingGenerator {
    pub fn new(dimension: usize) -> Self {
        Self { dimension }
    }

    /// Generate embedding from structured data
    pub fn embed_observation(
        &self,
        symbol: &str,
        timestamp_us: i64,
        price: f64,
        volume: f64,
        spread: f64,
    ) -> Vec<f32> {
        let mut data = Vec::new();
        data.extend_from_slice(&timestamp_us.to_le_bytes());
        data.extend_from_slice(symbol.as_bytes());
        data.extend_from_slice(&price.to_le_bytes());
        data.extend_from_slice(&volume.to_le_bytes());
        data.extend_from_slice(&spread.to_le_bytes());

        hash_embed(&data, self.dimension)
    }

    /// Generate embedding for trading signal
    pub fn embed_signal(
        &self,
        strategy_id: &str,
        symbol: &str,
        timestamp_us: i64,
        direction: u8,
        confidence: f64,
        features: &[f64],
    ) -> Vec<f32> {
        let mut data = Vec::new();
        data.extend_from_slice(&timestamp_us.to_le_bytes());
        data.extend_from_slice(strategy_id.as_bytes());
        data.extend_from_slice(symbol.as_bytes());
        data.push(direction);
        data.extend_from_slice(&confidence.to_le_bytes());

        // Include feature vector
        for &feature in features {
            data.extend_from_slice(&feature.to_le_bytes());
        }

        hash_embed(&data, self.dimension)
    }

    /// Generate embedding for order
    pub fn embed_order(
        &self,
        signal_id: &[u8],
        symbol: &str,
        side: u8,
        order_type: u8,
        quantity: u32,
        limit_price: Option<f64>,
    ) -> Vec<f32> {
        let mut data = Vec::new();
        data.extend_from_slice(signal_id);
        data.extend_from_slice(symbol.as_bytes());
        data.push(side);
        data.push(order_type);
        data.extend_from_slice(&quantity.to_le_bytes());

        if let Some(price) = limit_price {
            data.extend_from_slice(&price.to_le_bytes());
        }

        hash_embed(&data, self.dimension)
    }

    /// Calculate cosine similarity between embeddings
    pub fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot / (norm_a * norm_b)
    }

    /// Calculate Euclidean distance
    pub fn euclidean_distance(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return f32::MAX;
        }

        a.iter()
            .zip(b.iter())
            .map(|(x, y)| (x - y).powi(2))
            .sum::<f32>()
            .sqrt()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic_embedding() {
        let data = b"AAPL,150.0,1000";

        let embed1 = hash_embed(data, 512);
        let embed2 = hash_embed(data, 512);

        // Should be identical
        assert_eq!(embed1, embed2);
        assert_eq!(embed1.len(), 512);
    }

    #[test]
    fn test_embedding_uniqueness() {
        let data1 = b"AAPL,150.0,1000";
        let data2 = b"AAPL,150.1,1000";

        let embed1 = hash_embed(data1, 512);
        let embed2 = hash_embed(data2, 512);

        // Should be different
        assert_ne!(embed1, embed2);
    }

    #[test]
    fn test_embedding_range() {
        let data = b"test_data";
        let embedding = hash_embed(data, 256);

        // All values should be in [-1.0, 1.0]
        for &value in &embedding {
            assert!(value >= -1.0 && value <= 1.0);
        }
    }

    #[test]
    fn test_cosine_similarity() {
        let generator = EmbeddingGenerator::new(128);

        let embed1 = generator.embed_observation("AAPL", 1000000, 150.0, 1000.0, 0.01);
        let embed2 = generator.embed_observation("AAPL", 1000000, 150.0, 1000.0, 0.01);
        let embed3 = generator.embed_observation("MSFT", 1000000, 300.0, 2000.0, 0.02);

        // Identical embeddings should have similarity 1.0
        let sim1 = generator.cosine_similarity(&embed1, &embed2);
        assert!((sim1 - 1.0).abs() < 0.0001);

        // Different embeddings should have similarity < 1.0
        let sim2 = generator.cosine_similarity(&embed1, &embed3);
        assert!(sim2 < 0.99);
    }

    #[test]
    fn test_euclidean_distance() {
        let generator = EmbeddingGenerator::new(128);

        let embed1 = generator.embed_observation("AAPL", 1000000, 150.0, 1000.0, 0.01);
        let embed2 = generator.embed_observation("AAPL", 1000000, 150.0, 1000.0, 0.01);
        let embed3 = generator.embed_observation("MSFT", 1000000, 300.0, 2000.0, 0.02);

        // Identical embeddings should have distance 0
        let dist1 = generator.euclidean_distance(&embed1, &embed2);
        assert!(dist1 < 0.0001);

        // Different embeddings should have distance > 0
        let dist2 = generator.euclidean_distance(&embed1, &embed3);
        assert!(dist2 > 0.1);
    }

    #[test]
    fn test_embed_signal() {
        let generator = EmbeddingGenerator::new(768);

        let features = vec![0.5, 0.3, 0.8, 0.2];
        let embedding = generator.embed_signal(
            "momentum_v1",
            "AAPL",
            1000000,
            1, // Long
            0.85,
            &features,
        );

        assert_eq!(embedding.len(), 768);
    }
}
